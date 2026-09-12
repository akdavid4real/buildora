'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { publicApi } from '../lib/api-client';
import { DemoStore, INITIAL_DEMO_STATE } from '../lib/demo-store';
import type { DemoStoreState, PostItem } from '../lib/types';

type PublicFormConfig = {
  id: string;
  type: 'contact' | 'newsletter' | 'booking';
  title: string;
  pageSlug: string;
  enabled: boolean;
};

type IntegrationConfig = Record<string, { enabled: boolean; value?: string }>;

function extractContentHtml(item?: { content?: string; contentJson?: Record<string, unknown> | null }): string {
  if (!item) return '';
  if (typeof item.content === 'string' && item.content.trim().length > 0) return item.content;
  if (item.contentJson && typeof item.contentJson === 'object') {
    const doc = item.contentJson as {
      type?: string;
      content?: Array<{ type?: string; attrs?: { level?: number }; content?: Array<{ text?: string }>; text?: string }>;
    };
    if (Array.isArray(doc.content)) {
      return doc.content
        .map((n) => {
          const text = n.text || (n.content || []).map((c) => c.text || '').join('');
          if (n.type === 'heading') {
            const level = n.attrs?.level === 1 ? 'h1' : n.attrs?.level === 3 ? 'h3' : 'h2';
            return `<${level}>${text}</${level}>`;
          }
          if (n.type === 'paragraph') return text ? `<p>${text}</p>` : '';
          if (n.type === 'blockquote') return `<blockquote>${text}</blockquote>`;
          return text ? `<p>${text}</p>` : '';
        })
        .filter(Boolean)
        .join('');
    }
  }
  return '';
}

function themeClassFor(themeId: DemoStoreState['site']['themeId']) {
  if (themeId === 'minimal-blog') return '';
  if (themeId === 'small-business') return 'business';
  if (themeId === 'personal-portfolio') return 'portfolio';
  return themeId;
}

const EXTRA_THEME_STYLES = `
.public.agency { background:#0b1020; color:#f8fafc; }
.public.agency .public-header { background:#0f172a; border-color:#ffffff18; }
.public.agency .public-main { width:min(1080px,calc(100% - 40px)); }
.public.agency .public-main h1 { font-family:Inter,ui-sans-serif,sans-serif; font-weight:900; text-transform:uppercase; color:white; }
.public.agency .public-main h2,.public.agency .public-main p,.public.agency .public-main li { color:#d7e0ee; }
.public.agency .public-post { background:#111827; border-color:#263244; }
.public.restaurant { background:#241712; color:#fff4e6; }
.public.restaurant .public-header { background:#2f1f18; border-color:#ffffff18; }
.public.restaurant .public-main { width:min(860px,calc(100% - 40px)); }
.public.restaurant .public-main h1,.public.restaurant .public-main h2 { color:#f6d7aa; font-family:Georgia,serif; }
.public.restaurant .public-main p,.public.restaurant .public-main li { color:#ead9c8; }
.public.restaurant .public-post { background:#33231b; border-color:#5a3d2e; }
.public.saas { background:linear-gradient(180deg,#eef4ff 0%,#ffffff 42%); color:#172554; }
.public.saas .public-header { background:rgba(255,255,255,.86); backdrop-filter:blur(12px); }
.public.saas .public-main { width:min(1040px,calc(100% - 40px)); }
.public.saas .public-main h1 { font-family:Inter,ui-sans-serif,sans-serif; color:#1d4ed8; font-weight:900; }
.public.saas .public-main h2 { color:#1e3a8a; }
.public.saas .public-post { box-shadow:0 16px 40px rgba(37,99,235,.08); border-color:#dbe7ff; }
.public.event { background:linear-gradient(155deg,#2e1065 0%,#6b21a8 55%,#a21caf 100%); color:#fff; }
.public.event .public-header { background:#ffffff0d; border-color:#ffffff24; }
.public.event .public-main { width:min(980px,calc(100% - 40px)); }
.public.event .public-main h1 { color:#fff; font-family:Inter,ui-sans-serif,sans-serif; font-weight:950; }
.public.event .public-main h2,.public.event .public-main p,.public.event .public-main li { color:#f5e9ff; }
.public.event .public-post { background:#ffffff12; border-color:#ffffff26; color:white; }
.public.personal-brand { background:linear-gradient(180deg,#fff1f2,#fff7ed); color:#4c0519; }
.public.personal-brand .public-header { background:#fff8f5cc; backdrop-filter:blur(10px); }
.public.personal-brand .public-main { width:min(900px,calc(100% - 40px)); }
.public.personal-brand .public-main h1 { color:#9f1239; font-family:Georgia,serif; }
.public.personal-brand .public-main h2 { color:#be123c; }
.public.personal-brand .public-post { border-color:#fecdd3; box-shadow:0 12px 30px rgba(190,18,60,.06); }
.public-form { margin-top:36px; padding:24px; background:#ffffffd9; border:1px solid #dfe7e2; border-radius:16px; color:#17221e; }
.public-form h2 { margin-top:0!important; color:#17221e!important; }
.public-form .field label { color:#53615c; }
.public-actions { position:fixed; right:18px; bottom:18px; z-index:20; display:grid; gap:8px; }
.public-actions a { text-decoration:none; padding:10px 14px; border-radius:999px; background:var(--green); color:white; font-weight:800; box-shadow:0 10px 30px rgba(0,0,0,.18); }
`;

export function PublicSite({ slug, path }: { slug: string; path: string[] }) {
  const [state, setState] = useState<DemoStoreState>(INITIAL_DEMO_STATE);
  const [publicConfig, setPublicConfig] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSite = async () => {
      if (slug === 'my-site' || slug === 'demo') {
        if (active) {
          setState(DemoStore.getState());
          setReady(true);
        }
        return;
      }

      try {
        const publicSite = await publicApi.getSiteBySlug(slug);
        if (active && publicSite) {
          const config = (publicSite.themeConfig as Record<string, unknown>) || {};
          setPublicConfig(config);
          const mappedState: DemoStoreState = {
            version: 1,
            site: {
              siteName: publicSite.name,
              siteSlug: publicSite.slug,
              tagline: String(config.tagline || ''),
              themeId: (publicSite.themeId as DemoStoreState['site']['themeId']) || 'minimal-blog',
              accentColor: String(config.accentColor || '') || '#174d3e',
              customDomain: typeof config.customDomain === 'string' ? config.customDomain : undefined,
              seoTitle: typeof config.seoTitle === 'string' ? config.seoTitle : undefined,
              seoDescription: typeof config.seoDescription === 'string' ? config.seoDescription : undefined,
            },
            pages: publicSite.pages.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              isHomepage: p.isHomepage,
              status: 'PUBLISHED',
              content: extractContentHtml(p),
              contentJson: p.contentJson,
              seoTitle: p.seoTitle ?? undefined,
              seoDescription: p.seoDescription ?? undefined,
              updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
            })),
            posts: publicSite.posts.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              excerpt: p.excerpt ?? undefined,
              coverImageUrl: p.coverImageUrl ?? undefined,
              status: 'PUBLISHED',
              content: extractContentHtml(p),
              contentJson: p.contentJson,
              authorName: 'Buildora Author',
              tags: [],
              seoTitle: p.seoTitle ?? undefined,
              seoDescription: p.seoDescription ?? undefined,
              publishedAt: p.publishedAt ? (typeof p.publishedAt === 'string' ? p.publishedAt : new Date(p.publishedAt).toISOString()) : null,
              updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
            })),
            media: [],
            selectedPageId: publicSite.pages[0]?.id || '',
            selectedPostId: publicSite.posts[0]?.id || null,
            activeNav: 'overview',
          };
          setState(mappedState);
          setReady(true);
          return;
        }
      } catch {
        // Fall back gracefully to the browser demo.
      }

      if (active) {
        setState(DemoStore.getState());
        setReady(true);
      }
    };

    loadSite();
    return () => {
      active = false;
    };
  }, [slug]);

  const root = `/site/${slug}`;
  const isBlog = path[0] === 'blog';
  const postSlug = path[1];
  const pageSlug = path[0] ?? '';
  const page = pageSlug
    ? state.pages.find((item) => item.status === 'PUBLISHED' && item.slug === pageSlug)
    : state.pages.find((item) => item.status === 'PUBLISHED' && item.isHomepage);
  const post = state.posts.find((item) => item.status === 'PUBLISHED' && item.slug === postSlug);
  const publishedPosts = state.posts.filter((item) => item.status === 'PUBLISHED');
  const forms = Array.isArray(publicConfig.forms) ? (publicConfig.forms as PublicFormConfig[]) : [];
  const activeForm = !isBlog && page ? forms.find((form) => form.enabled && form.pageSlug === page.slug) : undefined;
  const integrations = (publicConfig.integrations && typeof publicConfig.integrations === 'object'
    ? publicConfig.integrations
    : {}) as IntegrationConfig;

  useEffect(() => {
    if (!ready) return;
    const activeItem = isBlog && post ? post : page;
    const title = activeItem?.seoTitle
      ? activeItem.seoTitle
      : activeItem
        ? `${activeItem.title} | ${state.site.siteName}`
        : state.site.seoTitle || state.site.siteName;

    if (typeof document !== 'undefined') {
      document.title = title;
      const description = activeItem?.seoDescription || state.site.seoDescription || state.site.tagline;
      if (description) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', description);
      }
    }
  }, [ready, isBlog, page, post, state.site]);

  useEffect(() => {
    const ga = integrations['google-analytics'];
    if (!ready || !ga?.enabled || !ga.value || typeof document === 'undefined') return;
    if (document.querySelector(`script[data-buildora-ga="${ga.value}"]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga.value)}`;
    script.dataset.buildoraGa = ga.value;
    document.head.appendChild(script);
    const inline = document.createElement('script');
    inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga.value.replace(/'/g, '')}');`;
    document.head.appendChild(inline);
  }, [ready, integrations]);

  if (!ready) return null;

  const themeClass = themeClassFor(state.site.themeId);
  const whatsapp = integrations.whatsapp;
  const calendly = integrations.calendly;
  const paystack = integrations.paystack;
  const mailchimp = integrations.mailchimp;

  return (
    <div className={`public ${themeClass}`} style={{ '--green': state.site.accentColor } as React.CSSProperties}>
      <style>{EXTRA_THEME_STYLES}</style>
      <header className="public-header">
        <Link href={root} className="brand">
          <span className="brand-mark">B</span>
          {state.site.siteName}
        </Link>
        <nav className="desktop-only">
          {state.pages
            .filter((item) => item.status === 'PUBLISHED' && !item.isHomepage && item.slug !== 'blog')
            .slice(0, 5)
            .map((item) => (
              <Link key={item.id} href={`${root}/${item.slug}`}>{item.title}</Link>
            ))}
          <Link href={`${root}/blog`}>Blog</Link>
        </nav>
      </header>
      <main className="public-main">
        {isBlog && !postSlug && <BlogList posts={publishedPosts} root={root} />}
        {isBlog && postSlug && (post ? <Article html={post.content} /> : <NotFound root={root} />)}
        {!isBlog && (page ? <><Article html={page.content} />{activeForm && <PublicForm slug={slug} form={activeForm} />}</> : <NotFound root={root} />)}
      </main>
      <div className="public-actions">
        {whatsapp?.enabled && whatsapp.value && (
          <a href={`https://wa.me/${whatsapp.value.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        )}
        {calendly?.enabled && calendly.value && (
          <a href={calendly.value} target="_blank" rel="noopener noreferrer">Book a call</a>
        )}
        {mailchimp?.enabled && mailchimp.value && (
          <a href={mailchimp.value} target="_blank" rel="noopener noreferrer">Newsletter</a>
        )}
        {paystack?.enabled && paystack.value && (
          <a href={paystack.value} target="_blank" rel="noopener noreferrer">Pay now</a>
        )}
      </div>
    </div>
  );
}

function PublicForm({ slug, form }: { slug: string; form: PublicFormConfig }) {
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = Object.fromEntries(new FormData(formElement).entries());
    setSubmitting(true);
    setStatus('');
    try {
      const response = await fetch(`/api/public/sites/${slug}/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to submit');
      formElement.reset();
      setStatus(payload?.message || 'Thanks — your response was received.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="public-form" onSubmit={submit}>
      <h2>{form.title}</h2>
      {form.type !== 'newsletter' && (
        <div className="field">
          <label>Name</label>
          <input className="input" name="name" required />
        </div>
      )}
      <div className="field">
        <label>Email</label>
        <input className="input" name="email" type="email" required />
      </div>
      {form.type === 'contact' && (
        <div className="field">
          <label>Message</label>
          <textarea className="textarea" name="message" required />
        </div>
      )}
      {form.type === 'booking' && (
        <>
          <div className="field"><label>Preferred date</label><input className="input" type="date" name="date" required /></div>
          <div className="field"><label>What do you need?</label><textarea className="textarea" name="message" required /></div>
        </>
      )}
      <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Sending…' : form.type === 'newsletter' ? 'Subscribe' : 'Send'}</button>
      {status && <p style={{ marginTop: 12, fontSize: 14 }}>{status}</p>}
    </form>
  );
}

function Article({ html }: { html: string }) {
  return <article dangerouslySetInnerHTML={{ __html: html }} />;
}

function BlogList({ posts, root }: { posts: PostItem[]; root: string }) {
  return (
    <>
      <span className="eyebrow">Latest stories</span>
      <h1>Ideas for a better web.</h1>
      <p>Practical notes on design, technology and growing your presence online.</p>
      <div className="public-posts">
        {posts.map((post) => (
          <Link className="public-post" key={post.id} href={`${root}/blog/${post.slug}`}>
            {post.coverImageUrl && <img src={post.coverImageUrl} alt="" />}
            <div>
              <span className="eyebrow">{post.tags[0] ?? 'Article'}</span>
              <h2 style={{ fontSize: 24, margin: '8px 0' }}>{post.title}</h2>
              <p>{post.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function NotFound({ root }: { root: string }) {
  return (
    <div className="empty">
      <h1>That page isn’t published yet.</h1>
      <p>Head back to the homepage or publish it from the Buildora dashboard.</p>
      <Link className="btn btn-primary" href={root}>Go home</Link>
    </div>
  );
}
