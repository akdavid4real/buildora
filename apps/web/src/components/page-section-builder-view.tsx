'use client';

import { ArrowLeft, Eye, Save } from 'lucide-react';
import Link from 'next/link';
import { useDemo } from '../lib/demo-context';
import type { PageItem } from '../lib/types';
import { SectionBuilder } from './section-builder';

export function PageSectionBuilderView({ id }: { id: string }) {
  const { state, patchPage } = useDemo();
  const page = state.pages.find((item) => item.id === id);

  if (!page) {
    return (
      <div className="content">
        <div className="card empty">
          <p>Page not found.</p>
          <Link href="/dashboard/pages" className="btn btn-primary">
            <ArrowLeft size={16} /> Back to pages
          </Link>
        </div>
      </div>
    );
  }

  const editorLike = {
    getJSON: () =>
      (page.contentJson as { type?: string; content?: Array<Record<string, unknown>> } | null) ?? {
        type: 'doc',
        content: [],
      },
    commands: {
      setContent: (content: unknown) => {
        patchPage(id, { contentJson: content as PageItem['contentJson'] });
      },
    },
  };

  const publicUrl = `/site/${state.site.siteSlug}${page.slug ? `/${page.slug}` : ''}`;

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <Link href={`/dashboard/pages/${id}`} style={{ textDecoration: 'none', color: '#53615c', fontSize: 13 }}>
            <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to editor
          </Link>
          <span className="eyebrow" style={{ display: 'block', marginTop: 12 }}>Visual builder</span>
          <h2 style={{ marginBottom: 6 }}>{page.title}</h2>
          <p>Add ready-made blocks and drag content into the order you want.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <Eye size={15} /> Preview
          </a>
          <button
            className="btn btn-primary"
            onClick={() => patchPage(id, { contentJson: editorLike.getJSON() }, 'Page layout saved')}
          >
            <Save size={15} /> Save layout
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <SectionBuilder
          editor={editorLike}
          onChanged={() => patchPage(id, { contentJson: editorLike.getJSON() })}
        />
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 660 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5ebe8', fontSize: 12, fontWeight: 800, color: '#53615c' }}>
            LIVE PAGE PREVIEW
          </div>
          <iframe
            key={`${page.updatedAt}-${page.slug}`}
            title="Live page preview"
            src={publicUrl}
            style={{ width: '100%', minHeight: 620, border: 0, background: 'white' }}
          />
        </div>
      </div>
    </div>
  );
}
