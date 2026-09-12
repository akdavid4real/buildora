'use client';

import { Loader2, Trash2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { mediaApi } from '../lib/api-client';
import { useDemo } from '../lib/demo-context';

export function MediaView() {
  const { state, updateState, isApiMode, currentSite, showNotice } = useDemo();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showNotice('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 1_500_000) {
      showNotice('For the hackathon demo, images must be 1.5MB or smaller.');
      return;
    }

    setUploading(true);

    try {
      if (isApiMode && currentSite) {
        const confirmed = await mediaApi.upload(currentSite.id, file);
        updateState(
          {
            ...state,
            media: [
              {
                id: confirmed.id,
                name: confirmed.originalFilename || confirmed.filename,
                mimeType: confirmed.mimeType,
                sizeBytes: confirmed.sizeBytes,
                url: confirmed.publicUrl,
                createdAt: new Date(confirmed.createdAt).toISOString(),
              },
              ...state.media,
            ],
          },
          'Image uploaded and saved',
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        updateState(
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
          'Image saved to local media library',
        );
      };
      reader.onerror = () => showNotice('Failed to read image file');
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      showNotice(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isApiMode && currentSite) {
      try {
        await mediaApi.delete(currentSite.id, id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete on server';
        showNotice(msg);
        return;
      }
    }

    updateState(
      {
        ...state,
        media: state.media.filter((m) => m.id !== id),
      },
      'Image removed',
    );
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Media library</span>
          <h2>Your visual assets</h2>
          <p>
            {isApiMode
              ? 'Upload images once and reuse them across your published content.'
              : 'Upload and manage images for this browser session.'}
          </p>
        </div>
        <label className="btn btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span>{uploading ? 'Uploading...' : 'Upload image'}</span>
          <input
            hidden
            type="file"
            disabled={uploading}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>
      </div>

      {state.media.length === 0 ? (
        <div className="card empty">
          <p style={{ marginBottom: 16 }}>No media uploaded yet.</p>
          <label className="btn btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span>{uploading ? 'Uploading...' : 'Upload your first image'}</span>
            <input
              hidden
              type="file"
              disabled={uploading}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>
      ) : (
        <div className="media-grid">
          {state.media.map((item) => (
            <article className="card media-card" key={item.id}>
              <img src={item.url} alt={item.name} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <small>{Math.round(item.sizeBytes / 1000)} KB</small>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '5px 8px', fontSize: 12 }}
                  onClick={() => handleDelete(item.id)}
                  title="Delete image"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
