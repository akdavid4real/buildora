import { prisma } from '@buildora/database';
import { ensureCommerceSchema, type CommerceProductRow } from '../../../../../../server/commerce';
import { ensureHackathonSchema, jsonError } from '../../../../../../server/hackathon';

type CheckoutItem = { productId?: string; quantity?: number };
type IntegrationConfig = Record<string, { enabled?: boolean; value?: string }>;

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureHackathonSchema();
    await ensureCommerceSchema();

    const site = await prisma.site.findUnique({ where: { slug: params.slug } });
    if (!site) return jsonError('Store not found', 404);

    const body = (await request.json()) as {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      items?: CheckoutItem[];
    };

    const customerName = String(body.customerName || '').trim();
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase();
    const customerPhone = String(body.customerPhone || '').trim();
    const requested = Array.isArray(body.items) ? body.items : [];

    if (!customerName) return jsonError('Customer name is required');
    if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return jsonError('A valid email is required');
    if (!requested.length) return jsonError('Your cart is empty');

    const normalized = requested
      .map((item) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.min(20, Math.round(Number(item.quantity || 1)))) }))
      .filter((item) => item.productId);
    if (!normalized.length) return jsonError('Your cart is empty');

    const productIds = Array.from(new Set(normalized.map((item) => item.productId)));
    const placeholders = productIds.map(() => '?').join(',');
    const products = await prisma.$queryRawUnsafe<CommerceProductRow[]>(
      `SELECT * FROM commerce_products WHERE siteId = ? AND status = 'PUBLISHED' AND id IN (${placeholders})`,
      site.id,
      ...productIds,
    );
    const productMap = new Map(products.map((product) => [product.id, product]));

    const items = normalized.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error('PRODUCT_UNAVAILABLE');
      if (product.stockQuantity < item.quantity) throw new Error(`OUT_OF_STOCK:${product.name}`);
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: product.price * item.quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const id = crypto.randomUUID();
    const paymentReference = `BLD-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 6).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'INSERT INTO commerce_orders (id, siteId, customerName, customerEmail, customerPhone, items, subtotal, total, currency, status, paymentStatus, paymentReference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        site.id,
        customerName.slice(0, 120),
        customerEmail.slice(0, 200),
        customerPhone ? customerPhone.slice(0, 50) : null,
        JSON.stringify(items),
        subtotal,
        subtotal,
        'NGN',
        'PENDING',
        'UNPAID',
        paymentReference,
      );

      for (const item of items) {
        await tx.$executeRawUnsafe(
          'UPDATE commerce_products SET stockQuantity = stockQuantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND siteId = ? AND stockQuantity >= ?',
          item.quantity,
          item.productId,
          site.id,
          item.quantity,
        );
      }
    });

    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const integrations = config.integrations && typeof config.integrations === 'object'
      ? (config.integrations as IntegrationConfig)
      : {};
    const paystack = integrations.paystack;
    const paymentUrl = paystack?.enabled && typeof paystack.value === 'string' && /^https:\/\//i.test(paystack.value)
      ? paystack.value
      : null;

    return Response.json({
      order: { id, reference: paymentReference, total: subtotal, currency: 'NGN', status: 'PENDING', paymentStatus: 'UNPAID' },
      paymentUrl,
      paymentReference,
      paystackUrl: paymentUrl,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_UNAVAILABLE') return jsonError('A product in your cart is no longer available', 409);
    if (error instanceof Error && error.message.startsWith('OUT_OF_STOCK:')) return jsonError(`${error.message.split(':').slice(1).join(':')} does not have enough stock`, 409);
    console.error('Commerce checkout failed', error);
    return jsonError('Unable to place order', 500);
  }
}
