import { prisma } from '@buildora/database';
import { ensureCommerceSchema } from '../../../../../../server/commerce';
import { assertOwnedSite, getHackathonUser, jsonError } from '../../../../../../server/hackathon';

const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const THEME_IDS = [
  'minimal-blog',
  'small-business',
  'personal-portfolio',
  'agency',
  'restaurant',
  'saas',
  'event',
  'personal-brand',
] as const;

function tiptap(title: string, paragraphs: string[]) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
      ...paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    ],
  };
}

function offerDoc(title: string, items: Array<{ name: string; body: string }>) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
      ...items.flatMap((item) => [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: item.name }] },
        { type: 'paragraph', content: [{ type: 'text', text: item.body }] },
      ]),
    ],
  };
}

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `story-${Date.now().toString(36)}`;
}

function looksLikeProductBusiness(description: string) {
  return /\b(sell|shop|store|product|products|skincare|fashion|clothing|jewelry|jewellery|cosmetics|beauty|food|beverage|merch|retail|ecommerce|e-commerce)\b/i.test(description);
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return jsonError('AI is not configured yet. Add MISTRAL_API_KEY.', 503);

  try {
    const { site: ownedSite } = await assertOwnedSite(params.siteId);
    const user = await getHackathonUser();
    const body = (await request.json()) as { description?: string };
    const description = body.description?.trim();
    if (!description || description.length < 10) return jsonError('Describe the business or website in at least 10 characters.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const started = Date.now();

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.65,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content:
              `You are Buildora, an expert website strategist. Return ONLY valid JSON with no markdown. Create concise, polished website copy. Theme must be one of ${THEME_IDS.join(', ')}. Pick the theme that best matches the business and audience. Decide whether the business primarily sells PRODUCTS or SERVICES and generate the offer section accordingly. For product businesses, also create realistic starter products with prices in Nigerian naira and sensible demo stock.`,
          },
          {
            role: 'user',
            content: `Create a starter website from this description:\n${description}\n\nReturn exactly this JSON shape:\n{\n  "siteName": "...",\n  "tagline": "...",\n  "themeId": "small-business",\n  "accentColor": "#174d3e",\n  "seoTitle": "...",\n  "seoDescription": "...",\n  "home": {"title":"Home","headline":"...","body":["...","..."],"cta":"..."},\n  "about": {"title":"About","body":["...","..."]},\n  "offerType": "products",\n  "offers": {"title":"Products","items":[{"name":"...","body":"..."},{"name":"...","body":"..."},{"name":"...","body":"..."}]},\n  "products": [{"name":"...","description":"...","priceNgn":15000,"stock":12},{"name":"...","description":"...","priceNgn":22000,"stock":8},{"name":"...","description":"...","priceNgn":12000,"stock":15}],\n  "blogIdeas": ["...","...","..."]\n}\n\nUse offerType "products" for retail/product businesses and "services" for service businesses. For services, return products as an empty array.`,
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

    const themeId = (THEME_IDS as readonly string[]).includes(generated.themeId) ? generated.themeId : 'small-business';
    const accentColor = /^#[0-9a-f]{6}$/i.test(generated.accentColor || '') ? generated.accentColor : '#174d3e';
    const blogIdeas = Array.isArray(generated.blogIdeas)
      ? generated.blogIdeas.map((idea: unknown) => String(idea).trim()).filter(Boolean).slice(0, 3)
      : [];
    const existingConfig = ownedSite.themeConfig && typeof ownedSite.themeConfig === 'object'
      ? (ownedSite.themeConfig as Record<string, unknown>)
      : {};

    const offerType = generated.offerType === 'products' || generated.offerType === 'services'
      ? generated.offerType
      : looksLikeProductBusiness(description)
        ? 'products'
        : 'services';
    const offerTitle = String(generated.offers?.title || (offerType === 'products' ? 'Products' : 'Services')).slice(0, 100);
    const offerItems = Array.isArray(generated.offers?.items)
      ? generated.offers.items
          .map((item: any) => ({
            name: String(item?.name || '').trim().slice(0, 100),
            body: String(item?.body || '').trim().slice(0, 500),
          }))
          .filter((item: { name: string; body: string }) => item.name && item.body)
          .slice(0, 6)
      : [];
    const fallbackOffers = offerType === 'products'
      ? [
          { name: 'Signature product', body: 'Highlight your flagship product and the problem it solves.' },
          { name: 'Customer favourite', body: 'Show another popular product with a clear reason to choose it.' },
          { name: 'New arrival', body: 'Introduce a newer product or collection visitors should notice.' },
        ]
      : [
          { name: 'Core service', body: 'Explain the main service and the outcome it creates.' },
          { name: 'Growth service', body: 'Present another useful service in clear customer language.' },
          { name: 'Premium support', body: 'Describe a higher-touch option for customers who need more help.' },
        ];
    const finalOffers = offerItems.length ? offerItems : fallbackOffers;

    const starterProducts = offerType === 'products'
      ? (Array.isArray(generated.products) ? generated.products : [])
          .map((item: any, index: number) => ({
            name: String(item?.name || finalOffers[index]?.name || `Product ${index + 1}`).trim().slice(0, 120),
            description: String(item?.description || finalOffers[index]?.body || 'A product created by Buildora AI.').trim().slice(0, 1200),
            price: Math.max(10000, Math.round(Number(item?.priceNgn || (12000 + index * 5000)) * 100)),
            stock: Math.max(1, Math.min(999, Math.round(Number(item?.stock || (10 + index * 3))))),
          }))
          .filter((item: { name: string }) => item.name)
          .slice(0, 6)
      : [];

    if (offerType === 'products' && starterProducts.length === 0) {
      finalOffers.slice(0, 3).forEach((item, index) => {
        starterProducts.push({
          name: item.name,
          description: item.body,
          price: (12000 + index * 5000) * 100,
          stock: 10 + index * 4,
        });
      });
    }

    const site = await prisma.site.update({
      where: { id: params.siteId },
      data: {
        name: String(generated.siteName || 'My Buildora Site').slice(0, 100),
        themeId,
        themeConfig: {
          ...existingConfig,
          tagline: String(generated.tagline || '').slice(0, 220),
          accentColor,
          seoTitle: String(generated.seoTitle || '').slice(0, 70),
          seoDescription: String(generated.seoDescription || '').slice(0, 160),
          generatedFrom: description,
          offerType,
          commerceEnabled: offerType === 'products',
          blogIdeas,
        },
      },
    });

    const homeBody = Array.isArray(generated.home?.body) ? generated.home.body.map(String) : [];
    const aboutBody = Array.isArray(generated.about?.body) ? generated.about.body.map(String) : [];
    const offerSlug = offerType === 'products' ? 'products' : 'services';
    const oppositeOfferSlug = offerType === 'products' ? 'services' : 'products';

    await prisma.$transaction(async (tx) => {
      await tx.page.updateMany({ where: { siteId: params.siteId, isHomepage: true }, data: { isHomepage: false } });
      await tx.page.updateMany({ where: { siteId: params.siteId, slug: oppositeOfferSlug }, data: { status: 'DRAFT', publishedAt: null } });

      const pages = [
        {
          slug: 'home',
          title: generated.home?.title || 'Home',
          isHomepage: true,
          contentJson: tiptap(generated.home?.headline || generated.siteName || 'Welcome', [
            ...homeBody,
            generated.home?.cta ? `Next step: ${generated.home.cta}` : '',
            offerType === 'products' ? 'Shop the collection from our online store.' : '',
          ].filter(Boolean)),
        },
        { slug: 'about', title: generated.about?.title || 'About', isHomepage: false, contentJson: tiptap(generated.about?.title || 'About', aboutBody) },
        { slug: offerSlug, title: offerTitle, isHomepage: false, contentJson: offerDoc(offerTitle, finalOffers) },
      ];

      for (const page of pages) {
        await tx.page.upsert({
          where: { siteId_slug: { siteId: params.siteId, slug: page.slug } },
          update: { title: page.title, contentJson: page.contentJson, isHomepage: page.isHomepage, status: 'PUBLISHED', publishedAt: new Date() },
          create: { siteId: params.siteId, slug: page.slug, title: page.title, contentJson: page.contentJson, isHomepage: page.isHomepage, status: 'PUBLISHED', publishedAt: new Date() },
        });
      }

      for (const idea of blogIdeas) {
        const slug = slugify(idea);
        const excerpt = `A practical guide from ${String(generated.siteName || 'our team')} about ${idea.toLowerCase()}.`;
        await tx.post.upsert({
          where: { siteId_slug: { siteId: params.siteId, slug } },
          update: { title: idea, excerpt, contentJson: tiptap(idea, [excerpt, 'Use the AI writing assistant to expand this starter article into a complete post.']), status: 'PUBLISHED', publishedAt: new Date() },
          create: { siteId: params.siteId, title: idea, slug, excerpt, contentJson: tiptap(idea, [excerpt, 'Use the AI writing assistant to expand this starter article into a complete post.']), status: 'PUBLISHED', publishedAt: new Date() },
        });
      }
    });

    if (offerType === 'products') {
      await ensureCommerceSchema();
      for (const product of starterProducts) {
        const productSlug = slugify(product.name);
        const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          'SELECT id FROM commerce_products WHERE siteId = ? AND slug = ? LIMIT 1',
          params.siteId,
          productSlug,
        );
        if (existing[0]) {
          await prisma.$executeRawUnsafe(
            'UPDATE commerce_products SET name = ?, description = ?, price = ?, stockQuantity = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            product.name,
            product.description,
            product.price,
            product.stock,
            'PUBLISHED',
            existing[0].id,
          );
        } else {
          await prisma.$executeRawUnsafe(
            'INSERT INTO commerce_products (id, siteId, name, slug, description, price, currency, imageUrl, stockQuantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            crypto.randomUUID(),
            params.siteId,
            product.name,
            productSlug,
            product.description,
            product.price,
            'NGN',
            null,
            product.stock,
            'PUBLISHED',
          );
        }
      }
    }

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
        metadata: { kind: 'SITE_GENERATOR', descriptionLength: description.length, generatedPosts: blogIdeas.length, offerType, generatedProducts: starterProducts.length },
      },
    });

    return Response.json({
      site,
      generated: {
        siteName: site.name,
        tagline: (site.themeConfig as Record<string, unknown>).tagline,
        themeId,
        accentColor,
        offerType,
        offerPage: offerSlug,
        shopUrl: offerType === 'products' ? `/site/${site.slug}/shop` : null,
        products: starterProducts,
        blogIdeas,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return jsonError('AI website generation timed out', 504);
    console.error('AI site generation failed', error);
    return jsonError('Unable to generate website', 500);
  }
}
