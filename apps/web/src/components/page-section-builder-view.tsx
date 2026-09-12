'use client';

import { ArrowLeft, Eye, FormInput, Save } from 'lucide-react';
import Link from 'next/link';
import { useDemo } from '../lib/demo-context';
import type { PageItem } from '../lib/types';
import { ReusableSections } from './reusable-sections';
import { SectionBuilder } from './section-builder';
import { VersionHistory } from './version-history';

export function PageSectionBuilderView({ id }: { id: string }) {
  const { state, patchPage, currentSite, refreshData } = useDemo();
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

  const publicUrl = page.isHomepage
    ? `/site/${state.site.siteSlug}`
    : `/site/${state.site.siteSlug}${page.slug ? `/${page.slug}` : ''}`;

  const getNodes = () => [...(editorLike.getJSON().content ?? [])];
  const insertReusable = (nodes: Array<Record<string, unknown>>) => {
    editorLike.commands.setContent({ type: 'doc', content: [...getNodes(), ...nodes] });
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <Link href={`/dashboard/pages/${id}`} style={{ textDecoration: 'none', color: '#53615c', fontSize: 13 }}>
            <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to editor
          </Link>
          <span className="eyebrow" style={{ display: 'block', marginTop: 12 }}>Visual builder</span>
          <h2 style={{ marginBottom: 6 }}>{page.title}</h2>
          <p>Add ready-made blocks, reuse saved layouts, connect forms, save versions and drag content into the order you want.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/dashboard/forms?pageSlug=${encodeURIComponent(page.slug)}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <FormInput size={15} /> Connect form
          </Link>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <SectionBuilder editor={editorLike} />
          <ReusableSections getNodes={getNodes} onInsert={insertReusable} siteId={currentSite?.id} />
          {currentSite && (
            <div style={{ marginTop: 14 }}>
              <VersionHistory siteId={currentSite.id} pageId={id} onRestored={refreshData} />
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 520, minWidth: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5ebe8', fontSize: 12, fontWeight: 800, color: '#53615c' }}>
            LIVE PAGE PREVIEW
          </div>
          <iframe
            key={`${page.updatedAt}-${page.slug}`}
            title="Live page preview"
            src={publicUrl}
            style={{ width: '100%', minHeight: 520, border: 0, background: 'white' }}
          />
        </div>
      </div>
    </div>
  );
}
