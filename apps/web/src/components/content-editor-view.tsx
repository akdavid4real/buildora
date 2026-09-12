'use client';

import {
  ArrowLeft,
  Bold,
  Eye,
  Globe2,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Save,
  Trash2,
  Undo2,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { aiApi } from '../lib/ai-client';
import { useDemo } from '../lib/demo-context';
import type { PageItem, PostItem } from '../lib/types';

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type RewriteMode = 'professional' | 'friendly' | 'shorter' | 'longer' | 'seo' | 'nigerian';

const REWRITE_MODES: Array<{ id: RewriteMode; label: string; actionType: 'REWRITE' | 'SHORTEN' | 'EXPAND'; instructions: string }> = [
  { id: 'professional', label: 'Professional', actionType: 'REWRITE', instructions: 'Rewrite in a polished, professional, confident tone suitable for a business website.' },
  { id: 'friendly', label: 'Friendly', actionType: 'REWRITE', instructions: 'Rewrite in a warm, approachable, conversational tone while keeping the meaning clear.' },
  { id: 'shorter', label: 'Shorter', actionType: 'SHORTEN', instructions: 'Make this tighter and easier to scan without losing the key message.' },
  { id: 'longer', label: 'Longer', actionType: 'EXPAND', instructions: 'Add useful detail, examples and clarity while avoiding fluff.' },
  { id: 'seo', label: 'SEO optimized', actionType: 'REWRITE', instructions: 'Rewrite for natural SEO readability, clear keyword context, helpful headings and strong user intent. Do not keyword-stuff.' },
  { id: 'nigerian', label: 'Nigerian audience', actionType: 'REWRITE', instructions: 'Rewrite for a modern Nigerian audience using natural, professional English and locally relevant framing without stereotypes or forced slang.' },
];

export function ContentEditorView({ kind, id }: { kind: 'pages' | 'posts'; id: string }) {
  const isPages = kind === 'pages';
  const { state, patchPage, patchPost, deletePage, deletePost, currentSite, showNotice } = useDemo();
  const router = useRouter();
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const collection = isPages ? state.pages : state.posts;
  const item = collection.find((i) => i.id === id);

  const editor = useEditor({
    extensions: [StarterKit],
    content: item?.contentJson ?? item?.content ?? '',
    immediatelyRender: false,
    onBlur: ({ editor: currentEditor }) => {
      if (item) patch({ content: currentEditor.getHTML(), contentJson: currentEditor.getJSON() });
    },
  });

  useEffect(() => {
    if (editor && item) {
      const targetContent = item.contentJson ?? item.content ?? '';
      if (!editor.isFocused) editor.commands.setContent(targetContent);
    }
  }, [editor, item?.id]);

  if (!item) {
    return (
      <div className="content">
        <div className="card empty">
          <p style={{ marginBottom: 16 }}>{isPages ? 'Page' : 'Post'} not found.</p>
          <Link href={`/dashboard/${kind}`} className="btn btn-primary">
            <ArrowLeft size={16} /> Back to {isPages ? 'Pages' : 'Blog posts'}
          </Link>
        </div>
      </div>
    );
  }

  const patch = (patchData: Partial<PageItem & PostItem>, message?: string) => {
    if (isPages) patchPage(id, patchData, message);
    else patchPost(id, patchData, message);
  };

  const handleSave = () => {
    if (editor) patch({ content: editor.getHTML(), contentJson: editor.getJSON() }, 'Changes saved');
    else patch({ content: item.content }, 'Changes saved');
  };

  const handleTogglePublish = () => {
    const isPublished = item.status === 'PUBLISHED';
    patch(
      { status: isPublished ? 'DRAFT' : 'PUBLISHED', publishedAt: isPublished ? null : new Date().toISOString() },
      isPublished ? 'Moved to drafts' : 'Published successfully',
    );
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete this ${isPages ? 'page' : 'post'} permanently?`)) return;
    if (isPages) {
      deletePage(item.id, `Deleted "${item.title}"`);
      router.push('/dashboard/pages');
    } else {
      deletePost(item.id, `Deleted "${item.title}"`);
      router.push('/dashboard/posts');
    }
  };

  const getAiContext = () => {
    const text = editor?.getText() || item.content || '';
    return `${item.title}\n\n${text}`.trim();
  };

  const runAi = async (actionType: 'TITLE' | 'DRAFT' | 'SEO_METADATA') => {
    if (!currentSite) {
      showNotice('Open a connected site to use AI.');
      return;
    }
    setAiLoading(actionType);
    try {
      const response = await aiApi.generate(currentSite.id, {
        actionType,
        context: getAiContext() || item.title,
        targetEntity: isPages ? 'PAGE' : 'POST',
      });
      if (actionType === 'TITLE') {
        const firstTitle = response.suggestion
          .split('\n')
          .map((line) => line.replace(/^\s*\d+[.)-]?\s*/, '').trim())
          .find(Boolean);
        if (firstTitle) patch({ title: firstTitle, slug: slugify(firstTitle) }, 'AI title generated');
      } else if (actionType === 'DRAFT') {
        if (editor) {
          editor.commands.setContent(response.suggestion);
          patch({ content: editor.getHTML(), contentJson: editor.getJSON() }, 'AI draft generated');
        }
      } else {
        const titleMatch = response.suggestion.match(/SEO Title:\s*(.+)/i);
        const descriptionMatch = response.suggestion.match(/SEO Description:\s*(.+)/i);
        patch(
          {
            seoTitle: titleMatch?.[1]?.trim() || item.seoTitle,
            seoDescription: descriptionMatch?.[1]?.trim() || item.seoDescription,
          },
          'AI SEO details generated',
        );
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'AI generation failed');
    } finally {
      setAiLoading(null);
    }
  };

  const runRewrite = async (mode: (typeof REWRITE_MODES)[number]) => {
    if (!currentSite || !editor) {
      showNotice('Open a connected site and add some content first.');
      return;
    }

    const { from, to, empty } = editor.state.selection;
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, '\n').trim();
    const fullText = editor.getText().trim();
    const sourceText = selectedText || fullText;
    if (!sourceText) {
      showNotice('Add some text before using AI rewrite.');
      return;
    }

    setAiLoading(`rewrite-${mode.id}`);
    try {
      const response = await aiApi.generate(currentSite.id, {
        actionType: mode.actionType,
        context: sourceText,
        instructions: `${mode.instructions}${selectedText ? ' Rewrite only the selected passage and return only its replacement.' : ''}`,
        targetEntity: isPages ? 'PAGE' : 'POST',
      });

      if (selectedText) {
        editor.chain().focus().insertContentAt({ from, to }, response.suggestion).run();
      } else {
        editor.commands.setContent(response.suggestion);
      }
      patch(
        { content: editor.getHTML(), contentJson: editor.getJSON() },
        `${mode.label} rewrite applied${selectedText ? ' to selection' : ''}`,
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'AI rewrite failed');
    } finally {
      setAiLoading(null);
    }
  };

  const publicUrl = isPages
    ? `/site/${state.site.siteSlug}${(item as PageItem).isHomepage ? '' : item.slug ? `/${item.slug}` : ''}`
    : `/site/${state.site.siteSlug}/blog/${item.slug}`;

  return (
    <div className="editor-view">
      <div className="editor-nav-bar">
        <div className="editor-nav-left">
          <Link href={`/dashboard/${kind}`} className="back-btn">
            <ArrowLeft size={16} /><span>Back to {isPages ? 'Pages' : 'Blog posts'}</span>
          </Link>
          <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>
            <i className={`dot ${item.status === 'PUBLISHED' ? 'live' : ''}`} style={{ marginRight: 5 }} />
            {item.status}
          </span>
        </div>

        <div className="editor-nav-right">
          {item.status === 'PUBLISHED' && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" title="Preview on live website">
              <Eye size={15} /><span>Preview</span>
            </a>
          )}
          {isPages && (
            <Link href={`/dashboard/pages/${id}/sections`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <WandSparkles size={15} /><span>Visual builder</span>
            </Link>
          )}
          <button className="btn btn-secondary" onClick={handleSave}><Save size={15} /><span>Save</span></button>
          <button className="btn btn-primary" onClick={handleTogglePublish}><Globe2 size={15} /><span>{item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</span></button>
        </div>
      </div>

      <div className="editor-columns">
        <div className="editor-card">
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.08em', color: '#53615c', marginBottom: 6 }}>
              {isPages ? 'Page title' : 'Post title'}
            </label>
            <input
              className="editor-title"
              value={item.title}
              placeholder="Enter title..."
              onChange={(e) => {
                const newTitle = e.target.value;
                patch({ title: newTitle, slug: slugify(newTitle) });
              }}
            />
          </div>

          <div className="slug" style={{ marginBottom: 20 }}>
            <span style={{ color: '#889892' }}>buildora.app/{isPages ? '' : 'blog/'}</span>
            <input value={item.slug} onChange={(e) => patch({ slug: slugify(e.target.value) })} aria-label="URL slug" placeholder="custom-slug" />
          </div>

          <div className="toolbar" aria-label="Text formatting">
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'active' : ''} disabled={!editor} title="Bold"><Bold size={14} /><span>Bold</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? 'active' : ''} disabled={!editor} title="Italic"><Italic size={14} /><span>Italic</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} disabled={!editor} title="Heading 2"><Heading2 size={15} /><span>H2</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={editor?.isActive('heading', { level: 3 }) ? 'active' : ''} disabled={!editor} title="Heading 3"><Heading3 size={15} /><span>H3</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? 'active' : ''} disabled={!editor} title="Bullet List"><List size={15} /><span>Bullet list</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={editor?.isActive('orderedList') ? 'active' : ''} disabled={!editor} title="Numbered List"><ListOrdered size={15} /><span>Numbered list</span></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? 'active' : ''} disabled={!editor} title="Blockquote"><Quote size={14} /><span>Quote</span></button>
            <button type="button" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} title="Undo"><Undo2 size={14} /><span>Undo</span></button>
            <button type="button" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} title="Redo"><Redo2 size={14} /><span>Redo</span></button>
          </div>

          <div className="rich"><EditorContent editor={editor} /></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ai-card" style={{ margin: 0 }}>
            <div className="panel-title"><WandSparkles size={17} /> AI writing assistant</div>
            <span className="badge">Mistral AI</span>
            <p style={{ marginTop: 8 }}>Generate titles, full drafts, SEO metadata, or rewrite selected text. With no selection, rewrite the whole document.</p>
            <div className="ai-actions">
              <button type="button" disabled={Boolean(aiLoading)} onClick={() => runAi('TITLE')}>{aiLoading === 'TITLE' ? 'Generating…' : '✨ Generate a title'}</button>
              <button type="button" disabled={Boolean(aiLoading)} onClick={() => runAi('DRAFT')}>{aiLoading === 'DRAFT' ? 'Generating…' : '✨ Generate first draft'}</button>
              <button type="button" disabled={Boolean(aiLoading)} onClick={() => runAi('SEO_METADATA')}>{aiLoading === 'SEO_METADATA' ? 'Generating…' : '✨ Generate SEO details'}</button>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #d9e7e0' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#53615c', marginBottom: 8 }}>REWRITE SELECTION / CONTENT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {REWRITE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '7px 9px' }}
                    disabled={Boolean(aiLoading)}
                    onClick={() => runRewrite(mode)}
                  >
                    {aiLoading === `rewrite-${mode.id}` ? 'Rewriting…' : mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Search Engine Optimization</h3>
            <div className="field">
              <label>SEO Title</label>
              <input className="input" value={item.seoTitle ?? ''} placeholder={item.title} onChange={(e) => patch({ seoTitle: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>SEO Description</label>
              <textarea className="textarea" style={{ minHeight: 85 }} placeholder="Brief summary for search engines and social cards..." value={item.seoDescription ?? ''} onChange={(e) => patch({ seoDescription: e.target.value })} />
            </div>
          </div>

          {!isPages && (
            <div className="card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 15, marginBottom: 14 }}>Post Details</h3>
              <div className="field">
                <label>Cover image</label>
                <select
                  className="input"
                  value={(item as PostItem).coverImageId ?? ''}
                  onChange={(e) => {
                    const media = state.media.find((asset) => asset.id === e.target.value);
                    patch({ coverImageId: e.target.value || null, coverImageUrl: media?.url ?? null }, media ? 'Cover image selected' : 'Cover image removed');
                  }}
                >
                  <option value="">No cover image</option>
                  {state.media.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                {(item as PostItem).coverImageUrl && (
                  <img src={(item as PostItem).coverImageUrl ?? ''} alt="Selected cover" style={{ width: '100%', borderRadius: 10, marginTop: 10, maxHeight: 150, objectFit: 'cover' }} />
                )}
              </div>
              <div className="field">
                <label>Author name</label>
                <input className="input" value={(item as PostItem).authorName ?? ''} onChange={(e) => patch({ authorName: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Excerpt / Summary</label>
                <textarea className="textarea" style={{ minHeight: 85 }} placeholder="Short teaser shown on blog listings..." value={(item as PostItem).excerpt ?? ''} onChange={(e) => patch({ excerpt: e.target.value })} />
              </div>
            </div>
          )}

          {(!isPages || !(item as PageItem).isHomepage) && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, color: '#9e2a2b', marginBottom: 10 }}>Danger Zone</h3>
              <p style={{ fontSize: 13, color: '#6f7c77', marginBottom: 12 }}>Permanently remove this {isPages ? 'page' : 'post'}.</p>
              <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={handleDelete}>
                <Trash2 size={15} /> Delete {isPages ? 'Page' : 'Post'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
