import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';
import { ensureCommerceSchema, type CommerceProductRow } from '../../../../../server/commerce';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const rows = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      'SELECT * FROM commerce_products WHERE siteId = ? ORDER BY createdAt DESC',
      params.siteId,
    );
    return Response.json({ data: rows });
  } catch {
    return jsonError('Unable to load products', 400);
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const price = Math.max(0, Math.round(Number(body.price || 0)));
    const stockQuantity = Math.max(0, Math.round(Number(body.stockQuantity || 0)));
    const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
    const status = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    if (!name) return jsonError('Product name is required');
    const slugBase = slugify(String(body.slug || name)) || `product-${Date.now().toString(36)}`;
    const id = crypto.randomUUID();
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;
    await prisma.$executeRawUnsafe(
      'INSERT INTO commerce_products (id, siteId, name, slug, description, price, currency, imageUrl, stockQuantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      params.siteId,
      name.slice(0, 120),
      slug,
      description.slice(0, 3000),
      price,
      'NGN',
      imageUrl,
      stockQuantity,
      status,
    );
    const [created] = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      'SELECT * FROM commerce_products WHERE id = ? LIMIT 1',
      id,
    );
    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error('Product create failed', error);
    return jsonError('Unable to create product', 400);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!id) return jsonError('Product id is required');
    const rows = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      'SELECT * FROM commerce_products WHERE id = ? AND siteId = ? LIMIT 1',
      id,
      params.siteId,
    );
    const current = rows[0];
    if (!current) return jsonError('Product not found', 404);
    const name = body.name === undefined ? current.name : String(body.name).trim();
    const description = body.description === undefined ? current.description : String(body.description);
    const price = body.price === undefined ? current.price : Math.max(0, Math.round(Number(body.price || 0)));
    const stockQuantity = body.stockQuantity === undefined ? current.stockQuantity : Math.max(0, Math.round(Number(body.stockQuantity || 0)));
    const imageUrl = body.imageUrl === undefined ? current.imageUrl : String(body.imageUrl || '').trim() || null;
    const status = body.status === undefined ? current.status : body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    await prisma.$executeRawUnsafe(
      'UPDATE commerce_products SET name = ?, description = ?, price = ?, imageUrl = ?, stockQuantity = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND siteId = ?',
      name.slice(0, 120), description.slice(0, 3000), price, imageUrl, stockQuantity, status, id, params.siteId,
    );
    const [updated] = await prisma.$queryRawUnsafe<CommerceProductRow[]>('SELECT * FROM commerce_products WHERE id = ? LIMIT 1', id);
    return Response.json(updated);
  } catch {
    return jsonError('Unable to update product', 400);
  }
}

export async function DELETE(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError('Product id is required');
    await prisma.$executeRawUnsafe('DELETE FROM commerce_products WHERE id = ? AND siteId = ?', id, params.siteId);
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete product', 400);
  }
}
