'use client';

import {
  BookOpen,
  Check,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DemoStore, INITIAL_DEMO_STATE } from '../lib/demo-store';
import type { DemoStoreState, PageItem, PostItem, ThemeId } from '../lib/types';

type Nav = DemoStoreState['activeNav'];
const NAV: { id: Nav; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'posts', label: 'Blog posts', icon: BookOpen },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const cloneInitial = () => JSON.parse(JSON.stringify(INITIAL_DEMO_STATE)) as DemoStoreState;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function Dashboard() {
  const [entered, setEntered] = useState(false);
  const [state, setState] = useState<DemoStoreState>(cloneInitial);
  const [hydrated, setHydrated] = useState(false);
  const [nav, setNav] = useState<Nav>('overview');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setState(DemoStore.getState());
    setEntered(sessionStorage.getItem('buildora-entered') === 'yes');
    setHydrated(true);
  }, []);

  const update = (next: DemoStoreState, message?: string) => {
    setState(next);
    DemoStore.saveState(next);
    if (message) {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 2200);
    }
  };

  if (!hydrated) return null;
  if (!entered) {
    return (
      <Login
        onEnter={() => {
          sessionStorage.setItem('buildora-entered', 'yes');
          setEntered(true);
        }}
      />
    );
  }

  const currentTitle = NAV.find((item) => item.id === nav)?.label ?? 'Overview';
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">B</span> Buildora
        </div>
        <div className="site-switch">
          <small>Current website</small>
          <strong>{state.site.siteName}</strong>
        </div>
        <nav className="nav" aria-label="Dashboard navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={nav === id ? 'active' : ''}
              onClick={() => {
                setNav(id);
                setMenu(false);
              }}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href={`/site/${state.site.siteSlug}`} target="_blank">
            <Globe2 size={14} style={{ display: 'inline', marginRight: 8 }} />
            View live website
          </a>
          <button
            className="btn btn-soft"
            onClick={() => {
              update(DemoStore.resetToDefault(), 'Demo content restored');
              setNav('overview');
            }}
          >
            <RotateCcw size={15} /> Reset demo
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="mobile-menu" aria-label="Open menu" onClick={() => setMenu(!menu)}>
              {menu ? <X /> : <Menu />}
            </button>
            <h1>{currentTitle}</h1>
          </div>
          <div className="top-actions">
            <a className="btn btn-secondary" href={`/site/${state.site.siteSlug}`} target="_blank">
              <Eye size={16} />
              <span>View site</span>
            </a>
            <span className="avatar">AK</span>
          </div>
        </header>
        {nav === 'overview' && <Overview state={state} setNav={setNav} />}
        {nav === 'pages' && <ContentWorkspace kind="pages" state={state} update={update} />}
        {nav === 'posts' && <ContentWorkspace kind="posts" state={state} update={update} />}
        {nav === 'media' && <Media state={state} update={update} />}
        {nav === 'appearance' && <Appearance state={state} update={update} />}
        {nav === 'settings' && <SiteSettings state={state} update={update} />}
      </main>
      {notice && (
        <div className="notice">
          <Check size={15} style={{ display: 'inline', marginRight: 8 }} />
          {notice}
        </div>
      )}
    </div>
  );
}

function Login({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <span className="brand-mark">B</span> Buildora
        </div>
        <div>
          <span className="eyebrow" style={{ color: '#d9ff79' }}>
            AI-powered. Human-approved.
          </span>
          <h1>Your website, without the usual headache.</h1>
          <p>
            Create pages, publish stories, manage media and get a little help from AI—all from one
            calm workspace.
          </p>
        </div>
        <small style={{ color: '#9bb9af' }}>Built for the hackathon. Ready for the demo.</small>
      </section>
      <section className="login-panel">
        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            onEnter();
          }}
        >
          <h2>Welcome back</h2>
          <p>Use the demo account to explore your CMS.</p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              className="input"
              id="email"
              type="email"
              defaultValue="demo@buildora.app"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              type="password"
              defaultValue="buildora"
              required
            />
          </div>
          <button className="btn btn-primary btn-wide" type="submit">
            Open demo dashboard
          </button>
          <small style={{ display: 'block', textAlign: 'center', marginTop: 15, color: '#7b8984' }}>
            No account or database required
          </small>
        </form>
      </section>
    </div>
  );
}

function Overview({ state, setNav }: { state: DemoStoreState; setNav: (nav: Nav) => void }) {
  const published =
    state.pages.filter((p) => p.status === 'PUBLISHED').length +
    state.posts.filter((p) => p.status === 'PUBLISHED').length;
  const stats = [
    ['Published content', published, Globe2],
    ['Pages', state.pages.length, FileText],
    ['Blog posts', state.posts.length, BookOpen],
    ['Media assets', state.media.length, ImageIcon],
  ] as const;
  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Site overview</span>
          <h2>Good afternoon, Alex.</h2>
          <p>Your website is live and looking healthy.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNav('pages')}>
          <Plus size={16} />
          Create content
        </button>
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
            {[...state.pages.slice(0, 3), ...state.posts.slice(0, 2)].map((item) => (
              <div className="activity-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {'authorName' in item ? 'Blog post' : 'Page'} · {item.status.toLowerCase()}
                  </small>
                </div>
                <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Quick actions</h3>
          <div className="quick">
            <button onClick={() => setNav('pages')}>
              <FileText size={20} />
              <br />
              New page
            </button>
            <button onClick={() => setNav('posts')}>
              <BookOpen size={20} />
              <br />
              New post
            </button>
            <button onClick={() => setNav('media')}>
              <Upload size={20} />
              <br />
              Upload image
            </button>
            <button onClick={() => setNav('appearance')}>
              <Palette size={20} />
              <br />
              Change theme
            </button>
          </div>
          <div className="ai-card" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="panel-title">
              <Sparkles size={17} />
              Demo mode enabled
            </div>
            <p>
              Everything is stored locally in this browser, so your presentation works without a
              server or API key.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentWorkspace({
  kind,
  state,
  update,
}: {
  kind: 'pages' | 'posts';
  state: DemoStoreState;
  update: (next: DemoStoreState, message?: string) => void;
}) {
  const isPages = kind === 'pages';
  const collection = isPages ? state.pages : state.posts;
  const selectedId = isPages ? state.selectedPageId : state.selectedPostId;
  const selected = collection.find((item) => item.id === selectedId) ?? collection[0];

  const select = (id: string) =>
    update({ ...state, ...(isPages ? { selectedPageId: id } : { selectedPostId: id }) });
  const create = () => {
    const id = `${isPages ? 'page' : 'post'}-${Date.now()}`;
    if (isPages) {
      const page: PageItem = {
        id,
        title: 'Untitled page',
        slug: `untitled-${Date.now()}`,
        isHomepage: false,
        status: 'DRAFT',
        content: '<h1>Untitled page</h1><p>Start writing something wonderful.</p>',
        updatedAt: new Date().toISOString(),
      };
      update({ ...state, pages: [page, ...state.pages], selectedPageId: id }, 'New page created');
    } else {
      const post: PostItem = {
        id,
        title: 'Untitled post',
        slug: `untitled-${Date.now()}`,
        status: 'DRAFT',
        content: '<h1>Untitled post</h1><p>Start writing your story.</p>',
        authorName: 'Alex Rivera',
        tags: [],
        updatedAt: new Date().toISOString(),
      };
      update({ ...state, posts: [post, ...state.posts], selectedPostId: id }, 'New post created');
    }
  };
  const patchItem = (patch: Partial<PageItem & PostItem>, message?: string) => {
    if (!selected) return;
    const items = collection.map((item) =>
      item.id === selected.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
    );
    update(
      { ...state, ...(isPages ? { pages: items as PageItem[] } : { posts: items as PostItem[] }) },
      message,
    );
  };
  if (!selected)
    return (
      <div className="empty">
        <button className="btn btn-primary" onClick={create}>
          <Plus size={16} />
          Create your first {isPages ? 'page' : 'post'}
        </button>
      </div>
    );
  return (
    <div className="workspace">
      <aside className="collection">
        <div className="collection-head">
          <strong>All {kind}</strong>
          <button className="circle-btn" aria-label={`New ${kind}`} onClick={create}>
            <Plus size={16} />
          </button>
        </div>
        {collection.map((item) => (
          <button
            key={item.id}
            className={`item ${selected.id === item.id ? 'active' : ''}`}
            onClick={() => select(item.id)}
          >
            <strong>{item.title}</strong>
            <span className="item-meta">
              <span>
                <i className={`dot ${item.status === 'PUBLISHED' ? 'live' : ''}`} />
                {item.status.toLowerCase()}
              </span>
              <span>edit</span>
            </span>
          </button>
        ))}
      </aside>
      <Editor item={selected} isPage={isPages} patchItem={patchItem} />
      <aside className="right-panel">
        <div className="ai-card">
          <div className="panel-title">
            <WandSparkles size={17} />
            AI writing assistant
          </div>
          <span className="badge">Demo fallback</span>
          <p>
            Generate polished starter copy locally. Connect Mistral later for real AI responses.
          </p>
          <div className="ai-actions">
            <button
              onClick={() =>
                patchItem(
                  {
                    title: isPages
                      ? 'A Better Way to Build Your Online Presence'
                      : '5 Simple Ways AI Makes Content Better',
                  },
                  'AI title generated',
                )
              }
            >
              Generate a title
            </button>
            <button
              onClick={() =>
                patchItem(
                  {
                    content: `<h1>${selected.title}</h1><p>Great ideas deserve a simple way to reach the world. Buildora brings your story, services, and personality together in one clear, beautiful experience.</p><h2>Designed around what matters</h2><p>We remove the busywork so you can focus on useful content, genuine connections, and growing your audience.</p><ul><li>Clear messaging that earns attention</li><li>Fast, accessible experiences</li><li>Simple tools your whole team can use</li></ul>`,
                  },
                  'Demo draft generated',
                )
              }
            >
              Generate first draft
            </button>
            <button
              onClick={() =>
                patchItem(
                  {
                    seoTitle: `${selected.title} | ${state.site.siteName}`,
                    seoDescription:
                      'Discover a simpler, faster way to build a beautiful online presence with practical tools and AI assistance.',
                  },
                  'SEO copy generated',
                )
              }
            >
              Generate SEO details
            </button>
          </div>
        </div>
        <div className="field">
          <label>SEO title</label>
          <input
            className="input"
            value={selected.seoTitle ?? ''}
            onChange={(e) => patchItem({ seoTitle: e.target.value })}
          />
        </div>
        <div className="field">
          <label>SEO description</label>
          <textarea
            className="textarea"
            style={{ minHeight: 95 }}
            value={selected.seoDescription ?? ''}
            onChange={(e) => patchItem({ seoDescription: e.target.value })}
          />
        </div>
        {!isPages && (
          <div className="field">
            <label>Excerpt</label>
            <textarea
              className="textarea"
              style={{ minHeight: 95 }}
              value={(selected as PostItem).excerpt ?? ''}
              onChange={(e) => patchItem({ excerpt: e.target.value })}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

function Editor({
  item,
  isPage,
  patchItem,
}: {
  item: PageItem | PostItem;
  isPage: boolean;
  patchItem: (patch: Partial<PageItem & PostItem>, message?: string) => void;
}) {
  const richRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (richRef.current && richRef.current.innerHTML !== item.content)
      richRef.current.innerHTML = item.content;
  }, [item.id, item.content]);
  const format = (command: string) => {
    document.execCommand(command);
    richRef.current?.focus();
  };
  return (
    <section className="editor">
      <div className="editor-top">
        <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>{item.status}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() =>
              patchItem({ content: richRef.current?.innerHTML ?? item.content }, 'Changes saved')
            }
          >
            <Save size={15} />
            Save
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              patchItem(
                {
                  status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                  publishedAt: item.status === 'PUBLISHED' ? null : new Date().toISOString(),
                },
                item.status === 'PUBLISHED' ? 'Moved to drafts' : 'Published successfully',
              )
            }
          >
            <Globe2 size={15} />
            {item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>
      <input
        className="editor-title"
        value={item.title}
        onChange={(e) => patchItem({ title: e.target.value, slug: slugify(e.target.value) })}
      />
      <div className="slug">
        buildora.app/{isPage ? '' : 'blog/'}
        <input
          value={item.slug}
          onChange={(e) => patchItem({ slug: slugify(e.target.value) })}
          aria-label="URL slug"
        />
      </div>
      <div className="toolbar" aria-label="Text formatting">
        <button onClick={() => format('bold')} aria-label="Bold">
          B
        </button>
        <button onClick={() => format('italic')} aria-label="Italic">
          <i>I</i>
        </button>
        <button onClick={() => format('formatBlock')} aria-label="Heading">
          H
        </button>
        <button onClick={() => format('insertUnorderedList')} aria-label="Bullet list">
          •
        </button>
      </div>
      <div
        ref={richRef}
        className="rich"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => patchItem({ content: e.currentTarget.innerHTML })}
      />
    </section>
  );
}

function Media({
  state,
  update,
}: {
  state: DemoStoreState;
  update: (next: DemoStoreState, message?: string) => void;
}) {
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () =>
      update(
        {
          ...state,
          media: [
            {
              id: `media-${Date.now()}`,
              name: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              url: String(reader.result),
              createdAt: new Date().toISOString(),
            },
            ...state.media,
          ],
        },
        'Image added to media library',
      );
    reader.readAsDataURL(file);
  };
  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Media library</span>
          <h2>Your visual assets</h2>
          <p>Upload images for this browser session and use them in your demo.</p>
        </div>
        <label className="btn btn-primary">
          <Upload size={16} />
          Upload image
          <input hidden type="file" accept="image/*" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <div className="media-grid">
        {state.media.map((item) => (
          <article className="card media-card" key={item.id}>
            <img src={item.url} alt={item.name} />
            <div>
              <strong>{item.name}</strong>
              <small>{Math.round(item.sizeBytes / 1000)} KB</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const THEMES: { id: ThemeId; name: string; className: string; description: string }[] = [
  {
    id: 'minimal-blog',
    name: 'Minimal Blog',
    className: '',
    description: 'Editorial, spacious and content-first.',
  },
  {
    id: 'small-business',
    name: 'Small Business',
    className: 'business',
    description: 'Confident, welcoming and conversion-ready.',
  },
  {
    id: 'personal-portfolio',
    name: 'Personal Portfolio',
    className: 'portfolio',
    description: 'Warm, creative and personality-led.',
  },
];
function Appearance({
  state,
  update,
}: {
  state: DemoStoreState;
  update: (next: DemoStoreState, message?: string) => void;
}) {
  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Appearance</span>
          <h2>Choose your site’s personality</h2>
          <p>One click updates the public website preview.</p>
        </div>
      </div>
      <div className="themes">
        {THEMES.map((theme) => (
          <button
            className={`theme ${state.site.themeId === theme.id ? 'selected' : ''}`}
            key={theme.id}
            onClick={() =>
              update(
                { ...state, site: { ...state.site, themeId: theme.id } },
                `${theme.name} applied`,
              )
            }
          >
            <div className={`theme-preview ${theme.className}`}>
              <small>BUILDORA</small>
              <b>Stories worth sharing.</b>
              <span />
              <span />
            </div>
            <strong>{theme.name}</strong>
            <p style={{ color: '#71807a', fontSize: 13 }}>{theme.description}</p>
            {state.site.themeId === theme.id && (
              <span className="badge">
                <Check size={11} /> Active
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SiteSettings({
  state,
  update,
}: {
  state: DemoStoreState;
  update: (next: DemoStoreState, message?: string) => void;
}) {
  const site = state.site;
  const change = (patch: Partial<typeof site>) => update({ ...state, site: { ...site, ...patch } });
  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Site settings</span>
          <h2>Brand and publishing details</h2>
          <p>Keep the essentials in one place.</p>
        </div>
        <button className="btn btn-primary" onClick={() => update(state, 'Settings saved')}>
          <Save size={16} />
          Save changes
        </button>
      </div>
      <div className="card settings-grid">
        <div className="field">
          <label>Site name</label>
          <input
            className="input"
            value={site.siteName}
            onChange={(e) => change({ siteName: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Site slug</label>
          <input
            className="input"
            value={site.siteSlug}
            onChange={(e) => change({ siteSlug: slugify(e.target.value) })}
          />
        </div>
        <div className="field" style={{ gridColumn: '1/-1' }}>
          <label>Tagline</label>
          <input
            className="input"
            value={site.tagline}
            onChange={(e) => change({ tagline: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Accent colour</label>
          <input
            className="input"
            type="color"
            style={{ height: 45, padding: 5 }}
            value={site.accentColor}
            onChange={(e) => change({ accentColor: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Custom domain (demo)</label>
          <input
            className="input"
            value={site.customDomain ?? ''}
            onChange={(e) => change({ customDomain: e.target.value })}
          />
        </div>
        <div className="field">
          <label>SEO title</label>
          <input
            className="input"
            value={site.seoTitle ?? ''}
            onChange={(e) => change({ seoTitle: e.target.value })}
          />
        </div>
        <div className="field">
          <label>SEO description</label>
          <textarea
            className="textarea"
            value={site.seoDescription ?? ''}
            onChange={(e) => change({ seoDescription: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
