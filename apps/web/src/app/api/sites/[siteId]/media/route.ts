import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function GET(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)));
    const search = url.searchParams.get('search')?.trim();
    const where = {
      siteId: params.siteId,
      ...(search
        ? {
            OR: [
              { filename: { contains: search, mode: 'insensitive' as const } },
              { originalFilename: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    return Response.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return jsonError('Unable to load media', 404);
  }
}
