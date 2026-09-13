'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  stockQuantity: number;
  status: 'PUBLISHED';
};

type StorePayload = {
  site: { name: string; slug: string; themeConfig?: Record<string, unknown> };
  products: Product[];
};

type CartLine = { productId: string; quantity: number };

function money(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);
}

export function Storefront({ slug, productSlug }: { slug: string; productSlug?: string }) {
  const [data, setData] = useState<StorePayload | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/sites/${slug}/products`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Store unavailable')))
      .then(setData)
      .catch(() => setData(null));
    try {
      const raw = localStorage.getItem(`buildora-cart:${slug}`);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, [slug]);

  useEffect(() => {
    try { localStorage.setItem(`buildora-cart:${slug}`, JSON.stringify(cart)); } catch {}
  }, [slug, cart]);

  const products = data?.products || [];
  const selected = productSlug ? products.find((product) => product.slug === productSlug) : undefined;
  const detailedCart = useMemo(() => cart.map((line) => ({ ...line, product: products.find((product) => product.id === line.productId) })).filter((line) => line.product), [cart, products]);
  const total = detailedCart.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const add = (product: Product) => {
    if (product.stockQuantity <= 0) return;
    setCart((items) => {
      const found = items.find((item) => item.productId === product.id);
      if (found) return items.map((item) => item.productId === product.id ? { ...item, quantity: Math.min(product.stockQuantity, item.quantity + 1) } : item);
      return [...items, { productId: product.id, quantity: 1 }];
    });
    setMessage(`${product.name} added to cart`);
  };
  const remove = (productId: string) => setCart((items) => items.filter((item) => item.productId !== productId));

  const checkout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/public/sites/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: values.name,
          customerEmail: values.email,
          customerPhone: values.phone,
          items: cart,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Checkout failed');
      setCart([]);
      setCheckoutOpen(false);
      setMessage(`Order created: ${payload.paymentReference}`);
      if (payload.paystackUrl) window.open(payload.paystackUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading storefront…</main>;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8f7', color: '#17221e' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e3e8e5', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href={`/site/${slug}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 900, fontSize: 20 }}>{data.site.name}</Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href={`/site/${slug}/shop`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>Shop</Link>
          <button className="btn btn-primary" onClick={() => setCheckoutOpen(true)}>Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})</button>
        </div>
      </header>

      <main style={{ width: 'min(1100px,calc(100% - 32px))', margin: '0 auto', padding: '48px 0' }}>
        {selected ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32, alignItems: 'start' }}>
            <div style={{ background: 'white', borderRadius: 18, overflow: 'hidden', minHeight: 360, display: 'grid', placeItems: 'center' }}>
              {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} style={{ width: '100%', height: '100%', maxHeight: 520, objectFit: 'cover' }} /> : <span style={{ color: '#839089' }}>No product image yet</span>}
            </div>
            <div>
              <span className="eyebrow">Product</span>
              <h1 style={{ fontSize: 44, marginBottom: 10 }}>{selected.name}</h1>
              <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 20 }}>{money(selected.price)}</div>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: '#52615b' }}>{selected.description}</p>
              <p style={{ fontWeight: 700 }}>{selected.stockQuantity > 0 ? `${selected.stockQuantity} in stock` : 'Out of stock'}</p>
              <button className="btn btn-primary" disabled={selected.stockQuantity <= 0} onClick={() => add(selected)}>Add to cart</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 30 }}><span className="eyebrow">Storefront</span><h1 style={{ fontSize: 44, marginBottom: 8 }}>Shop {data.site.name}</h1><p style={{ color: '#6f7c77' }}>Browse products generated and managed with Buildora.</p></div>
            {products.length === 0 ? <div className="card empty">No published products yet.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
                {products.map((product) => (
                  <article className="card" key={product.id} style={{ padding: 0, overflow: 'hidden' }}>
                    <Link href={`/site/${slug}/shop/${product.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      <div style={{ aspectRatio: '4/3', background: '#eef1ef', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#89958f' }}>Product image</span>}</div>
                      <div style={{ padding: 18 }}><h3 style={{ margin: '0 0 6px' }}>{product.name}</h3><p style={{ color: '#71807a', minHeight: 40 }}>{product.description.slice(0, 90)}</p><strong>{money(product.price)}</strong></div>
                    </Link>
                    <div style={{ padding: '0 18px 18px' }}><button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={product.stockQuantity <= 0} onClick={() => add(product)}>{product.stockQuantity > 0 ? 'Add to cart' : 'Out of stock'}</button></div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {message && <div className="notice" style={{ position: 'fixed' }}>{message}</div>}
      </main>

      {checkoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 50, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setCheckoutOpen(false)}>
          <div className="card" style={{ width: 'min(560px,100%)', maxHeight: '90vh', overflow: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><h2>Your cart</h2><button className="btn btn-secondary" onClick={() => setCheckoutOpen(false)}>Close</button></div>
            {detailedCart.length === 0 ? <p>Your cart is empty.</p> : detailedCart.map((line) => (
              <div key={line.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '12px 0', borderBottom: '1px solid #e5ebe8' }}>
                <div><strong>{line.product?.name}</strong><div style={{ color: '#71807a', fontSize: 13 }}>Qty {line.quantity} · {money((line.product?.price || 0) * line.quantity)}</div></div>
                <button className="btn btn-danger" onClick={() => remove(line.productId)}>Remove</button>
              </div>
            ))}
            <div style={{ fontSize: 20, fontWeight: 900, margin: '18px 0' }}>Total: {money(total)}</div>
            {detailedCart.length > 0 && <form onSubmit={checkout}>
              <div className="field"><label>Name</label><input className="input" name="name" required /></div>
              <div className="field"><label>Email</label><input className="input" name="email" type="email" required /></div>
              <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? 'Creating order…' : 'Checkout'}</button>
            </form>}
          </div>
        </div>
      )}
    </div>
  );
}
