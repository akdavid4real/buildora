import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';
import { ensureCommerceSchema, type CommerceOrderRow } from '../../../../../server/commerce';

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const rows = await prisma.$queryRawUnsafe<CommerceOrderRow[]>(
      'SELECT * FROM commerce_orders WHERE siteId = ? ORDER BY createdAt DESC LIMIT 100',
      params.siteId,
    );
    return Response.json({
      data: rows.map((row) => ({
        ...row,
        items: (() => { try { return JSON.parse(row.items); } catch { return []; } })(),
      })),
    });
  } catch {
    return jsonError('Unable to load orders', 400);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureCommerceSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || '');
    const status = ['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED'].includes(String(body.status)) ? String(body.status) : undefined;
    const paymentStatus = ['UNPAID', 'PAID', 'FAILED'].includes(String(body.paymentStatus)) ? String(body.paymentStatus) : undefined;
    if (!id || (!status && !paymentStatus)) return jsonError('Order update is invalid');
    if (status) await prisma.$executeRawUnsafe('UPDATE commerce_orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND siteId = ?', status, id, params.siteId);
    if (paymentStatus) await prisma.$executeRawUnsafe('UPDATE commerce_orders SET paymentStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND siteId = ?', paymentStatus, id, params.siteId);
    return Response.json({ ok: true });
  } catch {
    return jsonError('Unable to update order', 400);
  }
}
