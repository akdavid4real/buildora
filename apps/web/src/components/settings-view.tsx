'use client';

import { Save } from 'lucide-react';
import React from 'react';
import { useDemo } from '../lib/demo-context';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function SettingsView() {
  const { state, updateState } = useDemo();
  const site = state.site;

  const handleChange = (patch: Partial<typeof site>) => {
    updateState({
      ...state,
      site: {
        ...site,
        ...patch,
      },
    });
  };

  const handleSave = () => {
    updateState(state, 'Site settings saved');
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Site settings</span>
          <h2>Brand and publishing details</h2>
          <p>Manage your website title, slug, accent color and global SEO.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
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
            onChange={(e) => handleChange({ siteName: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Site slug</label>
          <input
            className="input"
            value={site.siteSlug}
            onChange={(e) => handleChange({ siteSlug: slugify(e.target.value) })}
          />
        </div>

        <div className="field" style={{ gridColumn: '1/-1' }}>
          <label>Tagline</label>
          <input
            className="input"
            value={site.tagline}
            onChange={(e) => handleChange({ tagline: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Accent colour</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="input"
              type="color"
              style={{ width: 50, height: 42, padding: 3, cursor: 'pointer' }}
              value={site.accentColor}
              onChange={(e) => handleChange({ accentColor: e.target.value })}
            />
            <span style={{ fontSize: 14, color: '#53615c', fontFamily: 'monospace' }}>
              {site.accentColor}
            </span>
          </div>
        </div>

        <div className="field">
          <label>Custom domain (demo)</label>
          <input
            className="input"
            value={site.customDomain ?? ''}
            placeholder="e.g. www.mybusiness.com"
            onChange={(e) => handleChange({ customDomain: e.target.value })}
          />
        </div>

        <div className="field" style={{ gridColumn: '1/-1' }}>
          <label>Default SEO Title</label>
          <input
            className="input"
            value={site.seoTitle ?? ''}
            placeholder={site.siteName}
            onChange={(e) => handleChange({ seoTitle: e.target.value })}
          />
        </div>

        <div className="field" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
          <label>Default SEO Description</label>
          <textarea
            className="textarea"
            value={site.seoDescription ?? ''}
            placeholder="Global search engine summary for your website..."
            onChange={(e) => handleChange({ seoDescription: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
