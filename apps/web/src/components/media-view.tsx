'use client';

import type { AllowedMediaMimeType } from '@buildora/contracts';
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
    if (!file.type.startsWith('image/')) {
      showNotice('Please select an image file (JPEG, PNG, WebP, GIF)');
      return;
    }

    setUploading(true);

    if (isApiMode && currentSite) {
      try {
        // Step 1: Request upload presigned URL
        const uploadReq = await mediaApi.requestUpload(currentSite.id, {
          filename: file.name,
          mimeType: file.type as AllowedMediaMimeType,
          sizeBytes: file.size,
        });

        // Step 2: Upload file directly to S3 via presigned PUT
        const s3Res = await fetch(uploadReq.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });

        if (!s3Res.ok) {
          throw new Error(`S3 upload failed with status ${s3Res.status}`);
        }

        // Step 3: Confirm upload on backend
        const confirmed = await mediaApi.confirmUpload(currentSite.id, {
          s3Key: uploadReq.s3Key,
          originalFilename: file.name,
          mimeType: file.type as AllowedMediaMimeType,
          sizeBytes: file.size,
        });

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
          'Image uploaded to S3 media library',
        );
        setUploading(false);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        showNotice(`API upload notice: ${msg} (saving to session)`);
      }
    }

    // Local fallback using Data URL
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
      setUploading(false);
    };
    reader.onerror = () => {
      showNotice('Failed to read image file');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    updateState(
      {
        ...state,
        media: state.media.filter((m) => m.id !== id),
      },
      'Image removed',
    );

    if (isApiMode && currentSite) {
      try {
        await mediaApi.delete(currentSite.id, id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete on server';
        showNotice(`API Media Delete Notice: ${msg}`);
      }
    }
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Media library</span>
          <h2>Your visual assets</h2>
          <p>
            {isApiMode
              ? 'Upload and manage media assets connected to your API backend.'
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
            accept="image/*"
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
              accept="image/*"
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
