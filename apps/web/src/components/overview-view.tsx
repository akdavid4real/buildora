'use client';

import {
  BookOpen,
  FileText,
  Globe2,
  Image as ImageIcon,
  Palette,
  Plus,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDemo } from '../lib/demo-context';

export function OverviewView() {
  const { state, createPage, isApiMode } = useDemo();
  const router = useRouter();

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
    } catch {
      // Creation failed; remain on overview view.
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
            <WandSparkles size={16} /> Set up site
          </Link>
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
            <span className="icon-box">
              <Icon size={19} />
            </span>
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
                <Link
                  key={item.id}
                  href={href}
                  className="activity-row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <small>{isPost ? 'Blog post' : 'Page'} · {item.status.toLowerCase()}</small>
                  </div>
                  <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>
                    {item.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3>Quick actions</h3>
          <div className="quick">
            <Link href="/dashboard/pages" style={{ textDecoration: 'none' }} className="btn btn-secondary">
              <FileText size={18} /> Pages
            </Link>
            <Link href="/dashboard/posts" style={{ textDecoration: 'none' }} className="btn btn-secondary">
              <BookOpen size={18} /> Blog posts
            </Link>
            <Link href="/dashboard/media" style={{ textDecoration: 'none' }} className="btn btn-secondary">
              <Upload size={18} /> Media
            </Link>
            <Link href="/dashboard/appearance" style={{ textDecoration: 'none' }} className="btn btn-secondary">
              <Palette size={18} /> Themes
            </Link>
          </div>
          <div className="ai-card" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="panel-title">
              <Sparkles size={17} />
              {isApiMode ? 'Connected workspace' : 'Offline demo mode'}
            </div>
            <p>
              {isApiMode
                ? 'Pages, posts, media and AI actions are connected to the Buildora backend.'
                : 'Local demo mode keeps the interface usable without a database connection.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
