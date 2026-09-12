import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const source = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.siteId } });
    if (!source) return jsonError('Page not found', 404);

    const suffix = Date.now().toString(36);
    const copy = await prisma.page.create({
      data: {
        siteId: params.siteId,
        title: `${source.title} Copy`,
        slug: `${source.slug}-copy-${suffix}`,
        contentJson: source.contentJson,
        status: 'DRAFT',
        isHomepage: false,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
      },
    });

    return Response.json(copy, { status: 201 });
  } catch {
    return jsonError('Unable to duplicate page', 400);
  }
}
