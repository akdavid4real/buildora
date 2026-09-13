import { prisma } from '@buildora/database';
import { ensureCommerceSchema, type CommerceProductRow } from '../../../../../../server/commerce';
import { ensureHackathonSchema, jsonError } from '../../../../../../server/hackathon';

type CartLine = { productId: string; quantity: number };

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureHackathonSchema();
    await ensureCommerceSchema();
    const site = await prisma.site.findUnique({ where: { slug: params.slug } });
    if (!site) return jsonError('Site not found', 404);

    const body = (await request.json()) as Record<string, unknown>;
    const customerName = String(body.customerName || '').trim();
    const customerEmail = String(body.customerEmail || '').trim();
    const customerPhone = String(body.customerPhone || '').trim() || null;
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: CartLine[] = rawItems
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.min(20, Math.round(Number(item.quantity || 1)))) }))
      .filter((item) => item.productId);

    if (!customerName || !customerEmail) return jsonError('Name and email are required');
    if (!items.length) return jsonError('Your cart is empty');

    const productIds = items.map((item) => item.productId);
    const placeholders = productIds.map(() => '?').join(',');
    const products = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      `SELECT * FROM commerce_products WHERE siteId = ? AND status = 'PUBLISHED' AND id IN (${placeholders})`,
      site.id,
      ...productIds,
    );
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = items.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      if (product.stockQuantity < line.quantity) throw new Error('OUT_OF_STOCK');
      return { productId: product.id, name: product.name, price: product.price, quantity: line.quantity, lineTotal: product.price * line.quantity };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderId = crypto.randomUUID();
    const paymentReference = `buildora-${orderId.slice(0, 8)}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'INSERT INTO commerce_orders (id, siteId, customerName, customerEmail, customerPhone, items, subtotal, total, currency, status, paymentStatus, paymentReference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        orderId,
        site.id,
        customerName.slice(0, 120),
        customerEmail.slice(0, 200),
        customerPhone,
        JSON.stringify(orderItems),
        subtotal,
        subtotal,
        'NGN',
        'PENDING',
        'UNPAID',
        paymentReference,
      );
      for (const item of orderItems) {
        await tx.$executeRawUnsafe(
          'UPDATE commerce_products SET stockQuantity = stockQuantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND siteId = ? AND stockQuantity >= ?',
          item.quantity,
          item.productId,
          site.id,
          item.quantity,
        );
      }
    });

    const config = site.themeConfig && typeof site.themeConfig === 'object' ? (site.themeConfig as Record<string, unknown>) : {};
    const integrations = config.integrations && typeof config.integrations === 'object' ? (config.integrations as Record<string, { enabled?: boolean; value?: string }>) : {};
    const paystack = integrations.paystack;

    return Response.json({
      orderId,
      paymentReference,
      total: subtotal,
      currency: 'NGN',
      paystackUrl: paystack?.enabled && paystack.value ? paystack.value : null,
      message: paystack?.enabled && paystack.value ? 'Order created. Continue to Paystack to pay.' : 'Order created. Payment link is not configured yet.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'OUT_OF_STOCK') return jsonError('One of the products no longer has enough stock', 409);
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') return jsonError('A product in your cart is no longer available', 404);
    console.error('Commerce checkout failed', error);
    return jsonError('Unable to create order', 500);
  }
}
