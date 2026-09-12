'use client';

import { BookOpen, Edit3, Eye, FileText, Globe2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDemo } from '../lib/demo-context';
import type { PageItem, PostItem } from '../lib/types';

export function ContentListView({ kind }: { kind: 'pages' | 'posts' }) {
  const isPages = kind === 'pages';
  const { state, createPage, createPost, patchPage, patchPost, deletePage, deletePost } = useDemo();
  const router = useRouter();

  const collection = isPages ? state.pages : state.posts;

  const handleCreate = async () => {
    try {
      const newId = isPages ? await createPage() : await createPost();
      if (newId) {
        router.push(`/dashboard/${kind}/${newId}`);
      }
    } catch {
      // Creation failed on API; remain on listing and display notification
    }
  };

  const handleTogglePublish = (item: PageItem | PostItem) => {
    const isPublished = item.status === 'PUBLISHED';
    const nextStatus = isPublished ? 'DRAFT' : 'PUBLISHED';
    const patch = {
      status: nextStatus as 'DRAFT' | 'PUBLISHED',
      publishedAt: isPublished ? null : new Date().toISOString(),
    };
    if (isPages) {
      patchPage(item.id, patch, isPublished ? 'Moved to drafts' : 'Page published');
    } else {
      patchPost(item.id, patch, isPublished ? 'Moved to drafts' : 'Post published');
    }
  };

  const handleDelete = (item: PageItem | PostItem) => {
    if (isPages) {
      deletePage(item.id, `Deleted "${item.title}"`);
    } else {
      deletePost(item.id, `Deleted "${item.title}"`);
    }
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">{isPages ? 'Content structure' : 'Editorial stories'}</span>
          <h2>{isPages ? 'Pages' : 'Blog posts'}</h2>
          <p>
            {isPages
              ? 'Organize and publish pages across your website.'
              : 'Publish articles, announcements and tutorials for your audience.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={16} />
          {isPages ? 'New page' : 'New post'}
        </button>
      </div>

      {collection.length === 0 ? (
        <div className="card empty">
          <p style={{ marginBottom: 16 }}>No {kind} found yet.</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={16} />
            Create your first {isPages ? 'page' : 'post'}
          </button>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>URL Slug</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {collection.map((item) => {
                const editHref = `/dashboard/${kind}/${item.id}`;
                const publicUrl = isPages
                  ? `/site/${state.site.siteSlug}${item.slug ? `/${item.slug}` : ''}`
                  : `/site/${state.site.siteSlug}/blog/${item.slug}`;
                const isHomepage = isPages && (item as PageItem).isHomepage;

                return (
                  <tr key={item.id}>
                    <td data-label="Title">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: '#f0f5f2',
                            color: '#174d3e',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isPages ? <FileText size={16} /> : <BookOpen size={16} />}
                        </div>
                        <div>
                          <Link href={editHref} className="table-title">
                            {item.title}
                          </Link>
                          <span className="table-subtitle">
                            {isHomepage && (
                              <span
                                className="badge"
                                style={{
                                  marginRight: 6,
                                  fontSize: 9,
                                  background: '#dcf0e7',
                                  color: '#15523f',
                                }}
                              >
                                Homepage
                              </span>
                            )}
                            {'authorName' in item && `By ${(item as PostItem).authorName} · `}
                            ID: {item.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td data-label="URL">
                      <code
                        style={{
                          background: '#f3f6f4',
                          padding: '3px 7px',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#344c42',
                        }}
                      >
                        /{isPages ? item.slug : `blog/${item.slug}`}
                      </code>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${item.status === 'DRAFT' ? 'draft' : ''}`}>
                        <i
                          className={`dot ${item.status === 'PUBLISHED' ? 'live' : ''}`}
                          style={{ marginRight: 5 }}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td data-label="Updated" style={{ color: '#6f7c77', fontSize: 13 }}>
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recent'}
                    </td>
                    <td data-label="Actions">
                      <div className="table-actions">
                        {item.status === 'PUBLISHED' && (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                            title="View on live site"
                          >
                            <Eye size={14} />
                          </a>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 13 }}
                          onClick={() => handleTogglePublish(item)}
                        >
                          <Globe2 size={14} />
                          {item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                        </button>
                        <Link
                          href={editHref}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: 13,
                            textDecoration: 'none',
                          }}
                        >
                          <Edit3 size={14} />
                          Edit
                        </Link>
                        {(!isPages || !(item as PageItem).isHomepage) && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                            onClick={() => handleDelete(item)}
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
