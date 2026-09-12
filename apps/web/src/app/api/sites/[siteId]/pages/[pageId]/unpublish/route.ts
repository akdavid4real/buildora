import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const page = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.siteId } });
    if (!page) return jsonError('Page not found', 404);
    const updated = await prisma.page.update({
      where: { id: page.id },
      data: { status: 'DRAFT', publishedAt: null },
    });
    return Response.json(updated);
  } catch {
    return jsonError('Unable to unpublish page', 400);
  }
}
