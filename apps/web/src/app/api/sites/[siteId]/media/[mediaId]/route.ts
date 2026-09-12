import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../server/hackathon';

export async function DELETE(_: Request, { params }: { params: { siteId: string; mediaId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const media = await prisma.mediaAsset.findFirst({
      where: { id: params.mediaId, siteId: params.siteId },
      include: { coverForPosts: { select: { id: true }, take: 1 } },
    });
    if (!media) return jsonError('Media not found', 404);
    if (media.coverForPosts.length > 0) {
      return jsonError('This image is currently used as a post cover.', 409);
    }
    await prisma.mediaAsset.delete({ where: { id: media.id } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete media', 400);
  }
}
