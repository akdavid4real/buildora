import { prisma } from '@buildora/database';
import { assertOwnedSite, getHackathonUser, jsonError } from '../../../../../../../server/hackathon';

const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';

function tiptap(title: string, paragraphs: string[]) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
      ...paragraphs.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    ],
  };
}

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return jsonError('AI is not configured yet. Add MISTRAL_API_KEY.', 503);

  try {
    await assertOwnedSite(params.siteId);
    const user = await getHackathonUser();
    const body = (await request.json()) as { description?: string };
    const description = body.description?.trim();
    if (!description || description.length < 10) {
      return jsonError('Describe the business or website in at least 10 characters.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const started = Date.now();

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.65,
        max_tokens: 2200,
        messages: [
          {
            role: 'system',
            content:
              'You are Buildora, an expert website strategist. Return ONLY valid JSON with no markdown. Create concise, polished website copy. Theme must be one of minimal-blog, small-business, personal-portfolio.',
          },
          {
            role: 'user',
            content: `Create a starter website from this description:\n${description}\n\nReturn exactly this JSON shape:\n{\n  "siteName": "...",\n  "tagline": "...",\n  "themeId": "small-business",\n  "accentColor": "#174d3e",\n  "seoTitle": "...",\n  "seoDescription": "...",\n  "home": {"title":"Home","headline":"...","body":["...","..."],"cta":"..."},\n  "about": {"title":"About","body":["...","..."]},\n  "services": {"title":"Services","body":["...","...","..."]},\n  "blogIdeas": ["...","...","..."]\n}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return jsonError('AI provider request failed', 502);

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return jsonError('AI returned an empty response', 502);

    let generated: any;
    try {
      generated = JSON.parse(cleanJson(raw));
    } catch {
      return jsonError('AI returned invalid website data. Try again.', 502);
    }

    const themeId = ['minimal-blog', 'small-business', 'personal-portfolio'].includes(generated.themeId)
      ? generated.themeId
      : 'small-business';
    const accentColor = /^#[0-9a-f]{6}$/i.test(generated.accentColor || '')
      ? generated.accentColor
      : '#174d3e';

    const site = await prisma.site.update({
      where: { id: params.siteId },
      data: {
        name: String(generated.siteName || 'My Buildora Site').slice(0, 100),
        themeId,
        themeConfig: {
          tagline: String(generated.tagline || '').slice(0, 220),
          accentColor,
          seoTitle: String(generated.seoTitle || '').slice(0, 70),
          seoDescription: String(generated.seoDescription || '').slice(0, 160),
          generatedFrom: description,
          blogIdeas: Array.isArray(generated.blogIdeas) ? generated.blogIdeas.slice(0, 3) : [],
        },
      },
    });

    const homeBody = Array.isArray(generated.home?.body) ? generated.home.body : [];
    const aboutBody = Array.isArray(generated.about?.body) ? generated.about.body : [];
    const servicesBody = Array.isArray(generated.services?.body) ? generated.services.body : [];

    await prisma.$transaction(async (tx) => {
      await tx.page.updateMany({
        where: { siteId: params.siteId, isHomepage: true },
        data: { isHomepage: false },
      });

      const pages = [
        {
          slug: 'home',
          title: generated.home?.title || 'Home',
          isHomepage: true,
          contentJson: tiptap(generated.home?.headline || generated.siteName || 'Welcome', [
            ...homeBody,
            generated.home?.cta ? `Next step: ${generated.home.cta}` : '',
          ].filter(Boolean)),
        },
        {
          slug: 'about',
          title: generated.about?.title || 'About',
          isHomepage: false,
          contentJson: tiptap(generated.about?.title || 'About', aboutBody),
        },
        {
          slug: 'services',
          title: generated.services?.title || 'Services',
          isHomepage: false,
          contentJson: tiptap(generated.services?.title || 'Services', servicesBody),
        },
      ];

      for (const page of pages) {
        await tx.page.upsert({
          where: { siteId_slug: { siteId: params.siteId, slug: page.slug } },
          update: {
            title: page.title,
            contentJson: page.contentJson,
            isHomepage: page.isHomepage,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
          create: {
            siteId: params.siteId,
            slug: page.slug,
            title: page.title,
            contentJson: page.contentJson,
            isHomepage: page.isHomepage,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
      }
    });

    const promptTokens = json.usage?.prompt_tokens ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;
    const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens;

    await prisma.aiGeneration.create({
      data: {
        siteId: params.siteId,
        userId: user.id,
        actionType: 'DRAFT',
        model: MODEL,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs: Date.now() - started,
        success: true,
        metadata: { kind: 'SITE_GENERATOR', descriptionLength: description.length },
      },
    });

    return Response.json({
      site,
      generated: {
        siteName: site.name,
        tagline: (site.themeConfig as Record<string, unknown>).tagline,
        themeId,
        accentColor,
        blogIdeas: (site.themeConfig as Record<string, unknown>).blogIdeas,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonError('AI website generation timed out', 504);
    }
    console.error('AI site generation failed', error);
    return jsonError('Unable to generate website', 500);
  }
}
