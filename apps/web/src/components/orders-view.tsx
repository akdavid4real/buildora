'use client';

import { CheckCircle2, ExternalLink, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDemo } from '../lib/demo-context';

type OrderItem = { productId: string; name: string; price: number; quantity: number; lineTotal: number };
type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: OrderItem[];
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  createdAt: string;
};

function money(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);
}

export function OrdersView() {
  const { currentSite, state, showNotice } = useDemo();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    if (!currentSite) return;
    const response = await fetch(`/api/sites/${currentSite.id}/orders`);
    if (response.ok) setOrders((await response.json()).data || []);
  };
  useEffect(() => { void load(); }, [currentSite?.id]);

  const patch = async (id: string, next: { status?: string; paymentStatus?: string }) => {
    if (!currentSite) return;
    const response = await fetch(`/api/sites/${currentSite.id}/orders`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...next }),
    });
    if (!response.ok) { showNotice('Unable to update order'); return; }
    await load();
    showNotice('Order updated');
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div><span className="eyebrow">Commerce</span><h2>Orders</h2><p>Track storefront orders and payment state for your Buildora shop.</p></div>
        <a className="btn btn-secondary" href={`/site/${state.site.siteSlug}/shop`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open shop</a>
      </div>
      {orders.length === 0 ? <div className="card empty">No orders yet. Place a test order from the public shop.</div> : (
        <div className="activity">
          {orders.map((order) => (
            <article className="card" key={order.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div><strong style={{ fontSize: 16 }}>{order.customerName}</strong><div style={{ color: '#71807a', fontSize: 12 }}>{order.customerEmail}{order.customerPhone ? ` · ${order.customerPhone}` : ''}</div><div style={{ color: '#71807a', fontSize: 12 }}>{new Date(order.createdAt).toLocaleString()}</div></div>
                <div style={{ textAlign: 'right' }}><strong style={{ fontSize: 18 }}>{money(order.total)}</strong><div style={{ fontSize: 12 }}>{order.paymentReference}</div></div>
              </div>
              <div style={{ margin: '14px 0', padding: '12px 0', borderTop: '1px solid #e5ebe8', borderBottom: '1px solid #e5ebe8' }}>
                {order.items.map((item) => <div key={`${order.id}-${item.productId}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span>{item.name} × {item.quantity}</span><span>{money(item.lineTotal)}</span></div>)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select className="select" value={order.status} onChange={(e) => patch(order.id, { status: e.target.value })}><option>PENDING</option><option>CONFIRMED</option><option>FULFILLED</option><option>CANCELLED</option></select>
                <select className="select" value={order.paymentStatus} onChange={(e) => patch(order.id, { paymentStatus: e.target.value })}><option>UNPAID</option><option>PAID</option><option>FAILED</option></select>
                {order.status === 'FULFILLED' ? <span className="badge"><PackageCheck size={13} /> Fulfilled</span> : null}
                {order.paymentStatus === 'PAID' ? <span className="badge"><CheckCircle2 size={13} /> Paid</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
