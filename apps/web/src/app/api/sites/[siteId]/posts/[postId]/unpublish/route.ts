import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string; postId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const post = await prisma.post.findFirst({ where: { id: params.postId, siteId: params.siteId } });
    if (!post) return jsonError('Post not found', 404);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { status: 'DRAFT', publishedAt: null },
      include: { coverImage: true },
    });
    const { coverImage, ...rest } = updated;
    return Response.json({ ...rest, coverImageUrl: coverImage?.publicUrl ?? null });
  } catch {
    return jsonError('Unable to unpublish post', 400);
  }
}
