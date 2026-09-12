'use client';

import { Copy, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useDemo } from '../lib/demo-context';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function SitesView() {
  const { sites, currentSite, refreshData, showNotice } = useDemo();
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const switchSite = async (site: (typeof sites)[number]) => {
    setSwitching(site.id);
    try {
      const response = await fetch(`/api/sites/${site.id}/activate`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to switch site');
      await refreshData();
      showNotice(`Switched to ${site.name}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to switch site');
    } finally {
      setSwitching(null);
    }
  };

  const createBlank = async () => {
    const name = window.prompt('Name the new website:', 'New Buildora Site')?.trim();
    if (!name) return;
    setCreating(true);
    try {
      const slugBase = slugify(name) || 'site';
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: `${slugBase}-${Date.now().toString(36)}`,
          themeId: 'minimal-blog',
          themeConfig: { tagline: 'A new website built with Buildora', accentColor: '#174d3e' },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to create site');
      await refreshData();
      showNotice(`${name} created and selected`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to create site');
    } finally {
      setCreating(false);
    }
  };

  const duplicate = async (site: (typeof sites)[number]) => {
    setDuplicating(site.id);
    try {
      const response = await fetch(`/api/sites/${site.id}/duplicate`, { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to duplicate site');
      await refreshData();
      showNotice(`${payload.name} created and selected`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to duplicate site');
    } finally {
      setDuplicating(null);
    }
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Workspaces</span>
          <h2>Your websites</h2>
          <p>Create, clone, switch between, and open multiple Buildora sites.</p>
        </div>
        <button className="btn btn-primary" onClick={createBlank} disabled={creating}>
          <Plus size={15} /> {creating ? 'Creating…' : 'New website'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {sites.map((site) => {
          const active = currentSite?.id === site.id;
          return (
            <article className="card" key={site.id} style={{ borderColor: active ? '#6da895' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 17 }}>{site.name}</strong>
                  <div style={{ color: '#71807a', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>/site/{site.slug}</div>
                </div>
                {active && <span className="badge">Active</span>}
              </div>
              <p style={{ fontSize: 13, color: '#6f7c77', minHeight: 36 }}>Theme: {site.themeId || 'minimal-blog'}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!active && (
                  <button className="btn btn-secondary" onClick={() => switchSite(site)} disabled={switching === site.id}>
                    <RefreshCw size={14} /> {switching === site.id ? 'Switching…' : 'Edit'}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => duplicate(site)} disabled={duplicating === site.id}>
                  <Copy size={14} /> {duplicating === site.id ? 'Cloning…' : 'Clone'}
                </button>
                <a className="btn btn-secondary" href={`/site/${site.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </article>
          );
        })}
        {sites.length === 0 && <div className="card empty">No websites yet.</div>}
      </div>
    </div>
  );
}
