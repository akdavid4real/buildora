'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { publicApi } from '../lib/api-client';
import { DemoStore, INITIAL_DEMO_STATE } from '../lib/demo-store';
import type { DemoStoreState, PostItem } from '../lib/types';

function extractContentHtml(item?: {
  content?: string;
  contentJson?: Record<string, unknown> | null;
}): string {
  if (!item) return '';
  if (typeof item.content === 'string' && item.content.trim().length > 0) {
    return item.content;
  }
  if (item.contentJson && typeof item.contentJson === 'object') {
    const doc = item.contentJson as {
      type?: string;
      content?: Array<{
        type?: string;
        content?: Array<{ text?: string }>;
        text?: string;
      }>;
    };
    if (Array.isArray(doc.content)) {
      return doc.content
        .map((n) => {
          if (n.type === 'heading') {
            const text = (n.content || []).map((c) => c.text || '').join('');
            return `<h2>${text}</h2>`;
          }
          if (n.type === 'paragraph') {
            const text = (n.content || []).map((c) => c.text || '').join('');
            return text ? `<p>${text}</p>` : '';
          }
          if (n.type === 'blockquote') {
            const text = (n.content || []).map((c) => c.text || '').join('');
            return `<blockquote>${text}</blockquote>`;
          }
          const text = n.text || (n.content || []).map((c) => c.text || '').join('');
          return text ? `<p>${text}</p>` : '';
        })
        .filter(Boolean)
        .join('');
    }
  }
  return '';
}

export function PublicSite({ slug, path }: { slug: string; path: string[] }) {
  const [state, setState] = useState<DemoStoreState>(INITIAL_DEMO_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSite = async () => {
      // If demo slug is requested directly, load demo store immediately
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
          const mappedState: DemoStoreState = {
            version: 1,
            site: {
              siteName: publicSite.name,
              siteSlug: publicSite.slug,
              tagline: String((publicSite.themeConfig as Record<string, unknown>)?.tagline || ''),
              themeId: (publicSite.themeId as DemoStoreState['site']['themeId']) || 'minimal-blog',
              accentColor:
                String((publicSite.themeConfig as Record<string, unknown>)?.accentColor || '') ||
                '#174d3e',
              customDomain:
                typeof (publicSite.themeConfig as Record<string, unknown>)?.customDomain ===
                'string'
                  ? ((publicSite.themeConfig as Record<string, unknown>).customDomain as string)
                  : undefined,
              seoTitle:
                typeof (publicSite.themeConfig as Record<string, unknown>)?.seoTitle === 'string'
                  ? ((publicSite.themeConfig as Record<string, unknown>).seoTitle as string)
                  : undefined,
              seoDescription:
                typeof (publicSite.themeConfig as Record<string, unknown>)?.seoDescription ===
                'string'
                  ? ((publicSite.themeConfig as Record<string, unknown>).seoDescription as string)
                  : undefined,
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
              updatedAt:
                typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
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
              publishedAt: p.publishedAt
                ? typeof p.publishedAt === 'string'
                  ? p.publishedAt
                  : new Date(p.publishedAt).toISOString()
                : null,
              updatedAt:
                typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
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
        // Fall back gracefully to DemoStore on network/API failure or 404
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
  const page = state.pages.find((item) => item.status === 'PUBLISHED' && item.slug === pageSlug);
  const post = state.posts.find((item) => item.status === 'PUBLISHED' && item.slug === postSlug);
  const publishedPosts = state.posts.filter((item) => item.status === 'PUBLISHED');

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
      const description =
        activeItem?.seoDescription || state.site.seoDescription || state.site.tagline;
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

  if (!ready) return null;

  const themeClass =
    state.site.themeId === 'small-business'
      ? 'business'
      : state.site.themeId === 'personal-portfolio'
        ? 'portfolio'
        : '';

  return (
    <div
      className={`public ${themeClass}`}
      style={{ '--green': state.site.accentColor } as React.CSSProperties}
    >
      <header className="public-header">
        <Link href={root} className="brand">
          <span className="brand-mark">B</span>
          {state.site.siteName}
        </Link>
        <nav className="desktop-only">
          {state.pages
            .filter(
              (item) => item.status === 'PUBLISHED' && !item.isHomepage && item.slug !== 'blog',
            )
            .slice(0, 4)
            .map((item) => (
              <Link key={item.id} href={`${root}/${item.slug}`}>
                {item.title}
              </Link>
            ))}
          <Link href={`${root}/blog`}>Blog</Link>
        </nav>
      </header>
      <main className="public-main">
        {isBlog && !postSlug && <BlogList posts={publishedPosts} root={root} />}
        {isBlog && postSlug && (post ? <Article html={post.content} /> : <NotFound root={root} />)}
        {!isBlog && (page ? <Article html={page.content} /> : <NotFound root={root} />)}
      </main>
    </div>
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
      <Link className="btn btn-primary" href={root}>
        Go home
      </Link>
    </div>
  );
}
