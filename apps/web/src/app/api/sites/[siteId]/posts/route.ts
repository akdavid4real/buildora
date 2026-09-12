import { createPostSchema, postListQuerySchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function GET(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const url = new URL(request.url);
    const query = postListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const where = {
      siteId: params.siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { coverImage: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.post.count({ where }),
    ]);

    const data = rows.map(({ coverImage, ...post }) => ({
      ...post,
      coverImageUrl: coverImage?.publicUrl ?? null,
    }));

    return Response.json({
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch {
    return jsonError('Unable to load posts', 404);
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const parsed = createPostSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid post data');

    if (parsed.data.coverImageId) {
      const media = await prisma.mediaAsset.findFirst({
        where: { id: parsed.data.coverImageId, siteId: params.siteId },
      });
      if (!media) return jsonError('Cover image does not belong to this site', 400);
    }

    const post = await prisma.post.create({
      data: {
        ...parsed.data,
        siteId: params.siteId,
        publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
      },
      include: { coverImage: true },
    });

    const { coverImage, ...rest } = post;
    return Response.json({ ...rest, coverImageUrl: coverImage?.publicUrl ?? null }, { status: 201 });
  } catch {
    return jsonError('Unable to create post', 400);
  }
}
