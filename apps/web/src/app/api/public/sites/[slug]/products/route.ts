import { prisma } from '@buildora/database';
import { ensureCommerceSchema, type CommerceProductRow } from '../../../../../../server/commerce';
import { ensureHackathonSchema, jsonError } from '../../../../../../server/hackathon';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureHackathonSchema();
    await ensureCommerceSchema();
    const site = await prisma.site.findUnique({ where: { slug: params.slug }, select: { id: true, name: true, slug: true, themeConfig: true } });
    if (!site) return jsonError('Site not found', 404);
    const products = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      "SELECT * FROM commerce_products WHERE siteId = ? AND status = 'PUBLISHED' ORDER BY createdAt DESC",
      site.id,
    );
    return Response.json({ site, products });
  } catch {
    return jsonError('Unable to load storefront', 500);
  }
}
