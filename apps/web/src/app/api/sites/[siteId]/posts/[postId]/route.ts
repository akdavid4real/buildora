import { updatePostSchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../server/hackathon';

async function getOwnedPost(siteId: string, postId: string) {
  await assertOwnedSite(siteId);
  const post = await prisma.post.findFirst({
    where: { id: postId, siteId },
    include: { coverImage: true },
  });
  if (!post) throw new Error('POST_NOT_FOUND');
  return post;
}

function shape(post: Awaited<ReturnType<typeof getOwnedPost>>) {
  const { coverImage, ...rest } = post;
  return { ...rest, coverImageUrl: coverImage?.publicUrl ?? null };
}

export async function GET(_: Request, { params }: { params: { siteId: string; postId: string } }) {
  try {
    return Response.json(shape(await getOwnedPost(params.siteId, params.postId)));
  } catch {
    return jsonError('Post not found', 404);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string; postId: string } }) {
  try {
    await getOwnedPost(params.siteId, params.postId);
    const parsed = updatePostSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid post data');

    if (parsed.data.coverImageId) {
      const media = await prisma.mediaAsset.findFirst({
        where: { id: parsed.data.coverImageId, siteId: params.siteId },
      });
      if (!media) return jsonError('Cover image does not belong to this site', 400);
    }

    const updated = await prisma.post.update({
      where: { id: params.postId },
      data: {
        ...parsed.data,
        ...(parsed.data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        ...(parsed.data.status === 'DRAFT' ? { publishedAt: null } : {}),
      },
      include: { coverImage: true },
    });
    return Response.json(shape(updated));
  } catch {
    return jsonError('Unable to update post', 400);
  }
}

export async function DELETE(_: Request, { params }: { params: { siteId: string; postId: string } }) {
  try {
    await getOwnedPost(params.siteId, params.postId);
    await prisma.post.delete({ where: { id: params.postId } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete post', 400);
  }
}
