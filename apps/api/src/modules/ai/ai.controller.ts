import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AiGenerationLogResponse,
  type AiLogListQuery,
  type GenerateAiContentDto,
  type GenerateAiContentResponse,
  type PaginatedResponse,
  aiLogListQuerySchema,
  generateAiContentSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AiService } from './ai.service';

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId/ai')
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(generateAiContentSchema)) dto: GenerateAiContentDto,
  ): Promise<GenerateAiContentResponse> {
    return this.aiService.generateContent(userId, siteId, dto);
  }

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  async listLogs(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Query(new ZodValidationPipe(aiLogListQuerySchema)) query: AiLogListQuery,
  ): Promise<PaginatedResponse<AiGenerationLogResponse>> {
    return this.aiService.listLogs(userId, siteId, query);
  }
}
