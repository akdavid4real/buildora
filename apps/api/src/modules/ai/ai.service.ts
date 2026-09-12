import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AiGeneration, Prisma } from '@buildora/database';
import {
  type AiActionType,
  type AiGenerationLogResponse,
  type AiLogListQuery,
  type GenerateAiContentDto,
  type GenerateAiContentResponse,
  type PaginatedResponse,
} from '@buildora/contracts';
import { PrismaService } from '../prisma/prisma.service';

interface MistralApiResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly dailyLimit = 20;
  private readonly timeoutMs = 20000;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  /**
   * Transforms internal AiGeneration database record into AiGenerationLogResponse contract.
   */
  private formatLogResponse(log: AiGeneration): AiGenerationLogResponse {
    return {
      id: log.id,
      siteId: log.siteId,
      userId: log.userId,
      actionType: log.actionType,
      model: log.model,
      promptTokens: log.promptTokens,
      completionTokens: log.completionTokens,
      totalTokens: log.totalTokens,
      durationMs: log.durationMs,
      success: log.success,
      errorMessage: log.errorMessage,
      metadata: (log.metadata as Record<string, unknown>) || {},
      createdAt: log.createdAt,
    };
  }

  /**
   * Verifies that the site exists and is owned by the requesting user.
   */
  private async verifySiteOwnership(userId: string, siteId: string): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        ownerId: userId,
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  /**
   * Enforces a per-user daily success rate limit of 20 generations.
   */
  private async checkDailyLimit(userId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const successfulToday = await this.prisma.aiGeneration.count({
      where: {
        userId,
        success: true,
        createdAt: { gte: startOfDay },
      },
    });

    if (successfulToday >= this.dailyLimit) {
      throw new HttpException(
        `Daily AI generation limit of ${this.dailyLimit} successful requests reached. Please try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Maps each action type to a concise, targeted instruction.
   */
  private getActionInstruction(actionType: AiActionType): string {
    switch (actionType) {
      case 'TITLE':
        return 'Generate 5 concise, engaging, click-worthy titles for the provided content. Return only the numbered list of titles.';
      case 'OUTLINE':
        return 'Generate a clean, structured outline with section headings and bullet points for the provided topic or context.';
      case 'DRAFT':
        return 'Draft a well-written, engaging draft based on the provided context. Structure with natural paragraphs and headings where appropriate.';
      case 'REWRITE':
        return 'Rewrite the provided text to improve clarity, flow, readability, and tone while preserving the core meaning.';
      case 'SHORTEN':
        return 'Condense and shorten the provided text, eliminating fluff and wordiness while keeping the essential message.';
      case 'EXPAND':
        return 'Expand the provided text with relevant details, clear explanations, and supporting examples without adding unnecessary fluff.';
      case 'EXCERPT':
        return 'Write a concise 1-2 sentence excerpt or summary of the provided content suitable for a card preview or summary.';
      case 'SEO_METADATA':
        return 'Generate an optimized SEO title (under 60 characters) and meta description (under 155 characters) for the provided content.';
      default:
        return 'Assist with the provided content according to the instructions.';
    }
  }

  /**
   * Generates AI suggestions using Mistral server-side fetch with timeout, daily limits, and logging.
   */
  async generateContent(
    userId: string,
    siteId: string,
    dto: GenerateAiContentDto,
  ): Promise<GenerateAiContentResponse> {
    await this.verifySiteOwnership(userId, siteId);

    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      throw new ServiceUnavailableException(
        'Mistral AI integration is not configured on this server',
      );
    }

    await this.checkDailyLimit(userId);

    const model = this.configService.get<string>('MISTRAL_MODEL', 'mistral-small-latest');
    const systemPrompt =
      'You are an expert AI content assistant for Buildora CMS. Provide helpful, polished suggestions. Never include conversational preamble (such as "Sure! Here is...") or postamble. Return only the requested content suggestion directly.';
    const actionInstruction = this.getActionInstruction(dto.actionType);
    const userPrompt = `Task: ${actionInstruction}${dto.instructions ? `\n\nAdditional user instructions: ${dto.instructions}` : ''}\n\nContext:\n${dto.context}`;

    const metadata: Prisma.InputJsonValue = {
      targetEntity: dto.targetEntity ?? null,
      contextLength: dto.context.length,
      instructionsLength: dto.instructions?.length ?? 0,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Upstream request failed');
        const errorMessage = `Mistral API error (${response.status}): ${errorText}`;
        this.logger.error(`Upstream AI error: ${errorMessage}`);

        await this.prisma.aiGeneration.create({
          data: {
            siteId,
            userId,
            actionType: dto.actionType,
            model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            durationMs,
            success: false,
            errorMessage: errorMessage.slice(0, 500),
            metadata,
          },
        });

        throw new BadGatewayException(`Upstream AI service error (${response.status})`);
      }

      const json = (await response.json()) as MistralApiResponse;
      const choice = json?.choices?.[0];
      const suggestion = choice?.message?.content?.trim();

      if (!suggestion) {
        const errorMessage = 'Received empty response from upstream AI service';
        await this.prisma.aiGeneration.create({
          data: {
            siteId,
            userId,
            actionType: dto.actionType,
            model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            durationMs,
            success: false,
            errorMessage,
            metadata,
          },
        });

        throw new BadGatewayException(errorMessage);
      }

      const promptTokens = json.usage?.prompt_tokens ?? 0;
      const completionTokens = json.usage?.completion_tokens ?? 0;
      const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens;

      await this.prisma.aiGeneration.create({
        data: {
          siteId,
          userId,
          actionType: dto.actionType,
          model,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          success: true,
          errorMessage: null,
          metadata,
        },
      });

      return {
        actionType: dto.actionType,
        suggestion,
        model,
        tokensUsed: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (error instanceof HttpException) {
        throw error;
      }

      const err = error as { name?: string; message?: string };
      const isTimeout = err?.name === 'AbortError';
      const errorMessage = isTimeout
        ? `AI generation request timed out after ${this.timeoutMs / 1000} seconds`
        : err?.message || 'Failed to communicate with AI provider';

      this.logger.error(`AI Generation failure: ${errorMessage}`);

      await this.prisma.aiGeneration.create({
        data: {
          siteId,
          userId,
          actionType: dto.actionType,
          model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMs,
          success: false,
          errorMessage: errorMessage.slice(0, 500),
          metadata,
        },
      });

      if (isTimeout) {
        throw new GatewayTimeoutException('AI service request timed out');
      }

      throw new BadGatewayException(`AI service communication failed: ${errorMessage}`);
    }
  }

  /**
   * Retrieves paginated AI generation history for an owned site with optional actionType filtering.
   */
  async listLogs(
    userId: string,
    siteId: string,
    query: AiLogListQuery,
  ): Promise<PaginatedResponse<AiGenerationLogResponse>> {
    await this.verifySiteOwnership(userId, siteId);

    const { page, limit, actionType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AiGenerationWhereInput = {
      siteId,
      ...(actionType ? { actionType } : {}),
    };

    const [total, logs] = await Promise.all([
      this.prisma.aiGeneration.count({ where }),
      this.prisma.aiGeneration.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: logs.map((log) => this.formatLogResponse(log)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
