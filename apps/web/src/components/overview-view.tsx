'use client';

import {
  BookOpen,
  Copy,
  FileText,
  FormInput,
  Globe2,
  Image as ImageIcon,
  LayoutTemplate,
  Palette,
  Plug,
  Plus,
  Rocket,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDemo } from '../lib/demo-context';

export function OverviewView() {
  const { state, createPage, isApiMode, currentSite, refreshData, showNotice } = useDemo();
  const router = useRouter();
  const firstPage = state.pages[0];

  const published =
    state.pages.filter((p) => p.status === 'PUBLISHED').length +
    state.posts.filter((p) => p.status === 'PUBLISHED').length;

  const stats = [
    ['Published content', published, Globe2],
    ['Pages', state.pages.length, FileText],
    ['Blog posts', state.posts.length, BookOpen],
    ['Media assets', state.media.length, ImageIcon],
  ] as const;

  const handleCreateContent = async () => {
    try {
      const id = await createPage();
      if (id) router.push(`/dashboard/pages/${id}`);
    } catch {}
  };

  const duplicateSite = async () => {
    if (!currentSite) return;
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/duplicate`, { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to duplicate site');
      await refreshData();
      showNotice(`Created ${payload.name}`);
      if (payload?.slug) window.open(`/site/${payload.slug}`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to duplicate site');
    }
  };

  const seedDemo = async () => {
    if (!currentSite) return;
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/seed-demo`, { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to load demo content');
      await refreshData();
      showNotice('Polished demo content loaded');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to load demo content');
    }
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Site overview</span>
          <h2>{state.site.siteName}</h2>
          <p>{state.site.tagline || 'Your website is ready to build and publish.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/onboarding" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <WandSparkles size={16} /> AI site builder
          </Link>
          {firstPage && (
            <Link href={`/dashboard/pages/${firstPage.id}/sections`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <LayoutTemplate size={16} /> Visual builder
            </Link>
          )}
          {isApiMode && currentSite && (
            <>
              <button className="btn btn-secondary" onClick={duplicateSite}>
                <Copy size={16} /> Duplicate site
              </button>
              <button className="btn btn-secondary" onClick={seedDemo}>
                <Rocket size={16} /> Load demo
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={handleCreateContent}>
            <Plus size={16} /> Create content
          </button>
        </div>
      </div>

      <section className="stats">
        {stats.map(([label, value, Icon]) => (
          <div className="card stat" key={label}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <span>Ready to share</span>
            </div>
            <span className="icon-box"><Icon size={19} /></span>
          </div>
        ))}
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Recently updated</h3>
          <div className="activity">
            {[...state.pages.slice(0, 3), ...state.posts.slice(0, 2)].map((item) => {
              const isPost = 'authorName' in item;
              const href = isPost ? `/dashboard/posts/${item.id}` : `/dashboard/pages/${item.id}`;
              return (
                <Link key={item.id} href={href} className="activity-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{isPost ? 'Blog post' : 'Page'} · {item.status.toLowerCase()}</small>
                  </div>
                  <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>{item.status}</span>
                </Link>
              );
            })}
            {state.pages.length === 0 && state.posts.length === 0 && (
              <div className="empty" style={{ padding: 28 }}>
                <p style={{ marginTop: 0 }}>Nothing here yet. Generate a website with AI or load the polished demo.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Quick actions</h3>
          <div className="quick">
            <Link href="/dashboard/pages" style={{ textDecoration: 'none' }} className="btn btn-secondary"><FileText size={18} /> Pages</Link>
            <Link href="/dashboard/posts" style={{ textDecoration: 'none' }} className="btn btn-secondary"><BookOpen size={18} /> Blog posts</Link>
            <Link href="/dashboard/media" style={{ textDecoration: 'none' }} className="btn btn-secondary"><Upload size={18} /> Media</Link>
            <Link href="/dashboard/appearance" style={{ textDecoration: 'none' }} className="btn btn-secondary"><Palette size={18} /> Themes</Link>
            <Link href="/dashboard/forms" style={{ textDecoration: 'none' }} className="btn btn-secondary"><FormInput size={18} /> Forms</Link>
            <Link href="/dashboard/integrations" style={{ textDecoration: 'none' }} className="btn btn-secondary"><Plug size={18} /> Integrations</Link>
          </div>
          <div className="ai-card" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="panel-title"><Sparkles size={17} />{isApiMode ? 'Connected workspace' : 'Offline demo mode'}</div>
            <p>{isApiMode ? 'Pages, posts, media, forms and AI actions are connected to the Buildora backend.' : 'Local demo mode keeps the interface usable without a database connection.'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
