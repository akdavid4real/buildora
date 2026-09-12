import { updatePageSchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../server/hackathon';

async function getOwnedPage(siteId: string, pageId: string) {
  await assertOwnedSite(siteId);
  const page = await prisma.page.findFirst({ where: { id: pageId, siteId } });
  if (!page) throw new Error('PAGE_NOT_FOUND');
  return page;
}

export async function GET(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    return Response.json(await getOwnedPage(params.siteId, params.pageId));
  } catch {
    return jsonError('Page not found', 404);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await getOwnedPage(params.siteId, params.pageId);
    const parsed = updatePageSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid page data');

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isHomepage) {
        await tx.page.updateMany({
          where: { siteId: params.siteId, isHomepage: true, id: { not: params.pageId } },
          data: { isHomepage: false },
        });
      }
      return tx.page.update({
        where: { id: params.pageId },
        data: {
          ...parsed.data,
          ...(parsed.data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
          ...(parsed.data.status === 'DRAFT' ? { publishedAt: null } : {}),
        },
      });
    });

    return Response.json(updated);
  } catch {
    return jsonError('Unable to update page', 400);
  }
}

export async function DELETE(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await getOwnedPage(params.siteId, params.pageId);
    await prisma.page.delete({ where: { id: params.pageId } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete page', 400);
  }
}
