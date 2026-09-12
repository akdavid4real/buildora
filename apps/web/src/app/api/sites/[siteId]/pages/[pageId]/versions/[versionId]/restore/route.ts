import { prisma } from '@buildora/database';
import { assertOwnedSite, ensureHackathonSchema, jsonError } from '../../../../../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string; pageId: string; versionId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureHackathonSchema();
    const page = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.siteId } });
    if (!page) return jsonError('Page not found', 404);

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      slug: string;
      contentJson: string;
      seoTitle: string | null;
      seoDescription: string | null;
    }>>(
      `SELECT id, title, slug, contentJson, seoTitle, seoDescription FROM page_versions WHERE id = ? AND pageId = ? AND siteId = ? LIMIT 1`,
      params.versionId,
      params.pageId,
      params.siteId,
    );
    const version = rows[0];
    if (!version) return jsonError('Version not found', 404);

    const restored = await prisma.page.update({
      where: { id: page.id },
      data: {
        title: version.title,
        slug: version.slug,
        contentJson: JSON.parse(version.contentJson),
        seoTitle: version.seoTitle,
        seoDescription: version.seoDescription,
      },
    });
    return Response.json(restored);
  } catch {
    return jsonError('Unable to restore version', 400);
  }
}
