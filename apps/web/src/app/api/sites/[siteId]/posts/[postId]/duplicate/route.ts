import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string; postId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const source = await prisma.post.findFirst({ where: { id: params.postId, siteId: params.siteId } });
    if (!source) return jsonError('Post not found', 404);

    const suffix = Date.now().toString(36);
    const copy = await prisma.post.create({
      data: {
        siteId: params.siteId,
        title: `${source.title} Copy`,
        slug: `${source.slug}-copy-${suffix}`,
        excerpt: source.excerpt,
        coverImageId: source.coverImageId,
        contentJson: source.contentJson,
        status: 'DRAFT',
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
      },
      include: { coverImage: true },
    });

    const { coverImage, ...rest } = copy;
    return Response.json({ ...rest, coverImageUrl: coverImage?.publicUrl ?? null }, { status: 201 });
  } catch {
    return jsonError('Unable to duplicate post', 400);
  }
}
