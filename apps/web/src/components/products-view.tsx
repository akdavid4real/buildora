'use client';

import { ExternalLink, PackagePlus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDemo } from '../lib/demo-context';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  stockQuantity: number;
  status: 'DRAFT' | 'PUBLISHED';
};

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value / 100);
}

export function ProductsView() {
  const { currentSite, state, showNotice } = useDemo();
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!currentSite) return;
    const response = await fetch(`/api/sites/${currentSite.id}/products`);
    if (response.ok) setProducts((await response.json()).data || []);
  };

  useEffect(() => { void load(); }, [currentSite?.id]);

  const createProduct = async () => {
    if (!currentSite) return;
    setCreating(true);
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New product', description: 'Describe what makes this product worth buying.', price: 1500000, stockQuantity: 10, status: 'DRAFT' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to create product');
      await load();
      showNotice('Product created');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to create product');
    } finally {
      setCreating(false);
    }
  };

  const save = async (product: Product) => {
    if (!currentSite) return;
    const response = await fetch(`/api/sites/${currentSite.id}/products`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
    });
    if (!response.ok) { showNotice('Unable to save product'); return; }
    showNotice('Product saved');
    await load();
  };

  const remove = async (id: string) => {
    if (!currentSite || !window.confirm('Delete this product?')) return;
    const response = await fetch(`/api/sites/${currentSite.id}/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { showNotice('Unable to delete product'); return; }
    setProducts((items) => items.filter((item) => item.id !== id));
    showNotice('Product deleted');
  };

  const patch = (id: string, next: Partial<Product>) => setProducts((items) => items.map((item) => item.id === id ? { ...item, ...next } : item));

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Commerce</span>
          <h2>Products</h2>
          <p>Manage the products Buildora can publish into a generated storefront.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-secondary" href={`/site/${state.site.siteSlug}/shop`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open shop</a>
          <button className="btn btn-primary" onClick={createProduct} disabled={!currentSite || creating}><PackagePlus size={15} /> {creating ? 'Creating…' : 'New product'}</button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card empty">No products yet. Add one manually or let the AI commerce generator create starter products.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
          {products.map((product) => (
            <section className="card" key={product.id}>
              {product.imageUrl && <img src={product.imageUrl} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />}
              <div className="field"><label>Name</label><input className="input" value={product.name} onChange={(e) => patch(product.id, { name: e.target.value })} /></div>
              <div className="field"><label>Description</label><textarea className="textarea" value={product.description} onChange={(e) => patch(product.id, { description: e.target.value })} /></div>
              <div className="settings-grid">
                <div className="field"><label>Price (kobo)</label><input className="input" type="number" min="0" value={product.price} onChange={(e) => patch(product.id, { price: Math.max(0, Number(e.target.value)) })} /><small>{money(product.price)}</small></div>
                <div className="field"><label>Stock</label><input className="input" type="number" min="0" value={product.stockQuantity} onChange={(e) => patch(product.id, { stockQuantity: Math.max(0, Number(e.target.value)) })} /></div>
              </div>
              <div className="field"><label>Image URL</label><input className="input" value={product.imageUrl || ''} onChange={(e) => patch(product.id, { imageUrl: e.target.value || null })} placeholder="https://..." /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={product.status === 'PUBLISHED'} onChange={(e) => patch(product.id, { status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })} /> Published</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn btn-primary" onClick={() => save(product)}><Save size={14} /> Save</button>
                <button className="btn btn-danger" onClick={() => remove(product.id)}><Trash2 size={14} /> Delete</button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
