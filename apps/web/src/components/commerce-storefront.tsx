'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  stockQuantity: number;
};

type CartLine = { productId: string; quantity: number };

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value / 100);
}

export function CommerceStorefront({ slug, path }: { slug: string; path: string[] }) {
  const root = `/site/${slug}`;
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/public/sites/${slug}/products`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load store')))
      .then((payload) => { if (active) setProducts(payload.products || []); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`buildora-cart:${slug}`);
      setCart(raw ? JSON.parse(raw) : []);
    } catch { setCart([]); }
  }, [slug]);

  useEffect(() => {
    try { localStorage.setItem(`buildora-cart:${slug}`, JSON.stringify(cart)); } catch {}
  }, [cart, slug]);

  const detailedCart = useMemo(() => cart
    .map((line) => ({ line, product: products.find((item) => item.id === line.productId) }))
    .filter((entry): entry is { line: CartLine; product: Product } => Boolean(entry.product)), [cart, products]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = detailedCart.reduce((sum, entry) => sum + entry.product.price * entry.line.quantity, 0);

  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => line.productId === product.id ? { ...line, quantity: Math.min(product.stockQuantity, line.quantity + 1) } : line);
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setCartOpen(true);
    setNotice(`${product.name} added to cart`);
  };

  const setQuantity = (product: Product, quantity: number) => {
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.productId !== product.id));
      return;
    }
    setCart((current) => current.map((line) => line.productId === product.id ? { ...line, quantity: Math.min(product.stockQuantity, quantity) } : line));
  };

  const section = path[0] || 'shop';
  const productSlug = section === 'shop' ? path[1] : undefined;
  const activeProduct = productSlug ? products.find((product) => product.slug === productSlug) : undefined;

  if (loading) return <div className="empty">Loading store…</div>;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .commerce-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:24px}
        .commerce-card{background:#fff;border:1px solid #e4e9e6;border-radius:16px;overflow:hidden;color:#17221e;box-shadow:0 12px 35px rgba(25,55,45,.06)}
        .commerce-card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#eef3f0}
        .commerce-card-body{padding:18px}.commerce-price{font-size:20px;font-weight:900;margin:8px 0}
        .commerce-stock{font-size:12px;color:#6f7c77}.commerce-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .commerce-cart-button{position:fixed;right:18px;top:82px;z-index:40;border:0;border-radius:999px;background:var(--green);color:white;padding:10px 14px;font-weight:850;cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.18)}
        .commerce-drawer{position:fixed;right:18px;top:132px;z-index:45;width:min(390px,calc(100vw - 36px));max-height:calc(100vh - 150px);overflow:auto;background:white;color:#17221e;border:1px solid #e3e8e5;border-radius:18px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.24)}
        .commerce-line{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid #eef1ef}.commerce-line input{width:64px}
        .commerce-checkout{background:#fff;color:#17221e;border:1px solid #e4e9e6;border-radius:18px;padding:24px;max-width:720px;margin:0 auto}
        @media(max-width:640px){.commerce-cart-button{top:auto;bottom:18px}.commerce-drawer{top:auto;bottom:72px;max-height:70vh}.commerce-grid{grid-template-columns:1fr 1fr;gap:10px}.commerce-card-body{padding:13px}}
      `}</style>

      <button className="commerce-cart-button" onClick={() => setCartOpen((open) => !open)}>Cart ({cartCount})</button>
      {cartOpen && (
        <div className="commerce-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0 }}>Your cart</h3><button className="btn btn-secondary" onClick={() => setCartOpen(false)}>Close</button></div>
          {detailedCart.length === 0 ? <p>Your cart is empty.</p> : detailedCart.map(({ product, line }) => (
            <div className="commerce-line" key={product.id}>
              <div><strong>{product.name}</strong><div>{money(product.price * line.quantity)}</div></div>
              <input className="input" type="number" min="0" max={product.stockQuantity} value={line.quantity} onChange={(event) => setQuantity(product, Number(event.target.value))} />
            </div>
          ))}
          {detailedCart.length > 0 && <><div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, margin: '16px 0' }}><span>Subtotal</span><span>{money(subtotal)}</span></div><Link className="btn btn-primary" href={`${root}/checkout`} style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }} onClick={() => setCartOpen(false)}>Checkout</Link></>}
        </div>
      )}

      {section === 'checkout' ? (
        <Checkout slug={slug} root={root} cart={cart} products={products} subtotal={subtotal} onCompleted={() => setCart([])} />
      ) : activeProduct ? (
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <Link href={`${root}/shop`} style={{ textDecoration: 'none', fontWeight: 800 }}>← Back to shop</Link>
          <div className="commerce-card" style={{ marginTop: 18 }}>
            {activeProduct.imageUrl && <img src={activeProduct.imageUrl} alt={activeProduct.name} />}
            <div className="commerce-card-body"><h1>{activeProduct.name}</h1><div className="commerce-price">{money(activeProduct.price)}</div><p>{activeProduct.description}</p><div className="commerce-stock">{activeProduct.stockQuantity > 0 ? `${activeProduct.stockQuantity} in stock` : 'Out of stock'}</div><div className="commerce-actions"><button className="btn btn-primary" disabled={activeProduct.stockQuantity <= 0} onClick={() => addToCart(activeProduct)}>{activeProduct.stockQuantity > 0 ? 'Add to cart' : 'Sold out'}</button></div></div>
          </div>
        </div>
      ) : (
        <>
          <span className="eyebrow">Online store</span>
          <h1>Shop {slug.replace(/-/g, ' ')}</h1>
          <p>Browse products and place an order directly from this Buildora-powered storefront.</p>
          {products.length === 0 ? <div className="empty">No products are published yet.</div> : <div className="commerce-grid">{products.map((product) => (
            <article className="commerce-card" key={product.id}>
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div style={{ aspectRatio: '4/3', display: 'grid', placeItems: 'center', background: '#eef3f0', fontSize: 42 }}>🛍️</div>}
              <div className="commerce-card-body"><Link href={`${root}/shop/${product.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}><h2 style={{ fontSize: 20, margin: 0 }}>{product.name}</h2></Link><div className="commerce-price">{money(product.price)}</div><p style={{ fontSize: 14 }}>{product.description}</p><div className="commerce-stock">{product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}</div><div className="commerce-actions"><button className="btn btn-primary" disabled={product.stockQuantity <= 0} onClick={() => addToCart(product)}>{product.stockQuantity > 0 ? 'Add to cart' : 'Sold out'}</button><Link className="btn btn-secondary" href={`${root}/shop/${product.slug}`} style={{ textDecoration: 'none' }}>View</Link></div></div>
            </article>
          ))}</div>}
        </>
      )}
      {notice && <div style={{ position: 'fixed', left: 18, bottom: 18, zIndex: 50, background: '#17221e', color: 'white', padding: '10px 14px', borderRadius: 10 }}>{notice}</div>}
    </div>
  );
}

function Checkout({ slug, root, cart, products, subtotal, onCompleted }: { slug: string; root: string; cart: CartLine[]; products: Product[]; subtotal: number; onCompleted: () => void }) {
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderRef, setOrderRef] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart.length) { setStatus('Your cart is empty.'); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitting(true); setStatus('');
    try {
      const response = await fetch(`/api/public/sites/${slug}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: data.customerName, customerEmail: data.customerEmail, customerPhone: data.customerPhone, items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to place order');
      onCompleted();
      setOrderRef(payload.order?.reference || payload.order?.id || 'Created');
      setStatus(payload.paymentUrl ? 'Order created. Opening payment…' : 'Order created successfully.');
      if (payload.paymentUrl) window.location.href = payload.paymentUrl;
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to place order'); }
    finally { setSubmitting(false); }
  };

  if (orderRef) return <div className="commerce-checkout"><h1>Order received</h1><p>Your order reference is <strong>{orderRef}</strong>.</p><p>{status}</p><Link className="btn btn-primary" href={`${root}/shop`} style={{ textDecoration: 'none' }}>Continue shopping</Link></div>;

  const detailed = cart.map((line) => ({ line, product: products.find((product) => product.id === line.productId) })).filter((item) => item.product);
  return <div className="commerce-checkout"><span className="eyebrow">Checkout</span><h1>Complete your order</h1>{detailed.length === 0 ? <><p>Your cart is empty.</p><Link href={`${root}/shop`} className="btn btn-primary" style={{ textDecoration: 'none' }}>Back to shop</Link></> : <><div style={{ marginBottom: 20 }}>{detailed.map(({ line, product }) => product && <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf0ee' }}><span>{product.name} × {line.quantity}</span><strong>{money(product.price * line.quantity)}</strong></div>)}<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, paddingTop: 14 }}><span>Total</span><span>{money(subtotal)}</span></div></div><form onSubmit={submit}><div className="field"><label>Name</label><input className="input" name="customerName" required /></div><div className="field"><label>Email</label><input className="input" type="email" name="customerEmail" required /></div><div className="field"><label>Phone</label><input className="input" name="customerPhone" /></div><button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Creating order…' : `Place order · ${money(subtotal)}`}</button>{status && <p style={{ marginTop: 12 }}>{status}</p>}</form></>}</div>;
}
