import { generateAiContentSchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, getHackathonUser, jsonError } from '../../../../../../server/hackathon';

const DAILY_LIMIT = 20;
const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';

function instruction(actionType: string) {
  switch (actionType) {
    case 'TITLE':
      return 'Generate 5 concise engaging titles. Return only the titles, one per line.';
    case 'OUTLINE':
      return 'Generate a structured outline with clear headings and useful bullet points.';
    case 'DRAFT':
      return 'Write a polished draft with useful headings and natural paragraphs. Return HTML suitable for a rich text editor.';
    case 'REWRITE':
      return 'Rewrite the text for clarity, flow and readability while preserving its meaning.';
    case 'SHORTEN':
      return 'Shorten the text while preserving the essential meaning.';
    case 'EXPAND':
      return 'Expand the text with useful detail without adding fluff.';
    case 'EXCERPT':
      return 'Write a concise 1-2 sentence excerpt.';
    case 'SEO_METADATA':
      return 'Return exactly two lines: SEO Title: <under 60 characters> and SEO Description: <under 155 characters>.';
    default:
      return 'Improve the supplied content.';
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return jsonError('AI is not configured yet. Add MISTRAL_API_KEY.', 503);

  try {
    await assertOwnedSite(params.siteId);
    const user = await getHackathonUser();
    const parsed = generateAiContentSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid AI request');

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const usedToday = await prisma.aiGeneration.count({
      where: { userId: user.id, success: true, createdAt: { gte: startOfDay } },
    });
    if (usedToday >= DAILY_LIMIT) return jsonError('Daily AI generation limit reached.', 429);

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.7,
          max_tokens: 1500,
          messages: [
            {
              role: 'system',
              content:
                'You are Buildora, an expert website content assistant. Return only the requested content with no conversational preamble.',
            },
            {
              role: 'user',
              content: `${instruction(parsed.data.actionType)}${parsed.data.instructions ? `\n\nExtra instructions: ${parsed.data.instructions}` : ''}\n\nContext:\n${parsed.data.context}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const durationMs = Date.now() - started;
      if (!response.ok) {
        const detail = await response.text().catch(() => 'Mistral request failed');
        await prisma.aiGeneration.create({
          data: {
            siteId: params.siteId,
            userId: user.id,
            actionType: parsed.data.actionType,
            model: MODEL,
            durationMs,
            success: false,
            errorMessage: detail.slice(0, 500),
            metadata: { targetEntity: parsed.data.targetEntity ?? null },
          },
        });
        return jsonError('AI provider request failed', 502);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const suggestion = json.choices?.[0]?.message?.content?.trim();
      if (!suggestion) return jsonError('AI returned an empty response', 502);

      const promptTokens = json.usage?.prompt_tokens ?? 0;
      const completionTokens = json.usage?.completion_tokens ?? 0;
      const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens;

      await prisma.aiGeneration.create({
        data: {
          siteId: params.siteId,
          userId: user.id,
          actionType: parsed.data.actionType,
          model: MODEL,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          success: true,
          metadata: { targetEntity: parsed.data.targetEntity ?? null },
        },
      });

      return Response.json({
        actionType: parsed.data.actionType,
        suggestion,
        model: MODEL,
        tokensUsed: { promptTokens, completionTokens, totalTokens },
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        return jsonError('AI request timed out', 504);
      }
      throw error;
    }
  } catch (error) {
    console.error('AI generation failed', error);
    return jsonError('Unable to generate AI content', 500);
  }
}
