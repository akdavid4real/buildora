import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const [pages, posts, media] = await Promise.all([
      prisma.page.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'asc' } }),
      prisma.post.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'asc' } }),
      prisma.mediaAsset.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'asc' } }),
    ]);

    const payload = {
      format: 'buildora-site-export-v1',
      exportedAt: new Date().toISOString(),
      site: {
        name: site.name,
        slug: site.slug,
        description: site.description,
        themeId: site.themeId,
        themeConfig: site.themeConfig,
      },
      pages: pages.map(({ siteId: _siteId, ...page }) => page),
      posts: posts.map(({ siteId: _siteId, ...post }) => post),
      media: media.map(({ siteId: _siteId, uploaderId: _uploaderId, ...asset }) => asset),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${site.slug}-buildora.json"`,
      },
    });
  } catch {
    return jsonError('Unable to export site', 400);
  }
}
