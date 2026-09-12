import { createPageSchema, pageListQuerySchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function GET(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const url = new URL(request.url);
    const query = pageListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const where = {
      siteId: params.siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { slug: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.page.count({ where }),
    ]);
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
    return jsonError('Unable to load pages', 404);
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const parsed = createPageSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid page data');

    const page = await prisma.$transaction(async (tx) => {
      if (parsed.data.isHomepage) {
        await tx.page.updateMany({
          where: { siteId: params.siteId, isHomepage: true },
          data: { isHomepage: false },
        });
      }
      return tx.page.create({
        data: {
          ...parsed.data,
          siteId: params.siteId,
          publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
        },
      });
    });

    return Response.json(page, { status: 201 });
  } catch {
    return jsonError('Unable to create page', 400);
  }
}
