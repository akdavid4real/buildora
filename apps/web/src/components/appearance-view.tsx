'use client';

import { Check, ExternalLink } from 'lucide-react';
import React from 'react';
import { useDemo } from '../lib/demo-context';
import type { ThemeId } from '../lib/types';

const THEMES: { id: ThemeId; name: string; className: string; description: string }[] = [
  {
    id: 'minimal-blog',
    name: 'Minimal Blog',
    className: '',
    description: 'Editorial, spacious and content-first typography.',
  },
  {
    id: 'small-business',
    name: 'Small Business',
    className: 'business',
    description: 'Confident, welcoming and conversion-ready layout.',
  },
  {
    id: 'personal-portfolio',
    name: 'Personal Portfolio',
    className: 'portfolio',
    description: 'Warm, creative and personality-led presentation.',
  },
];

const PRESET_COLORS = ['#174d3e', '#2563eb', '#7c3aed', '#c2410c', '#be123c', '#111827'];

export function AppearanceView() {
  const { state, updateState } = useDemo();

  const handleSelectTheme = (themeId: ThemeId, themeName: string) => {
    updateState(
      {
        ...state,
        site: {
          ...state.site,
          themeId,
        },
      },
      `${themeName} applied`,
    );
  };

  const handleColor = (accentColor: string) => {
    updateState({
      ...state,
      site: { ...state.site, accentColor },
    });
  };

  const previewUrl = `/site/${state.site.siteSlug}`;

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Appearance</span>
          <h2>Choose your site’s personality</h2>
          <p>Theme and colour changes update the public website immediately.</p>
        </div>
        <a className="btn btn-secondary" href={previewUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> Open live site
        </a>
      </div>

      <div className="themes">
        {THEMES.map((theme) => {
          const isSelected = state.site.themeId === theme.id;
          return (
            <button
              key={theme.id}
              className={`theme ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectTheme(theme.id, theme.name)}
              type="button"
            >
              <div className={`theme-preview ${theme.className}`} style={{ '--green': state.site.accentColor } as React.CSSProperties}>
                <small>{state.site.siteName.toUpperCase()}</small>
                <b>{state.site.tagline || 'Stories worth sharing.'}</b>
                <span />
                <span />
              </div>
              <strong>{theme.name}</strong>
              <p style={{ color: '#71807a', fontSize: 13 }}>{theme.description}</p>
              {isSelected && (
                <span className="badge">
                  <Check size={11} style={{ marginRight: 4 }} /> Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="card" style={{ marginTop: 22, padding: 22 }}>
        <div className="hero-row" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Brand colour</h3>
            <p style={{ margin: 0 }}>Pick a preset or choose any custom accent colour.</p>
          </div>
          <input
            type="color"
            value={state.site.accentColor}
            onChange={(e) => handleColor(e.target.value)}
            aria-label="Custom accent colour"
            style={{ width: 52, height: 42, padding: 3, borderRadius: 9, cursor: 'pointer' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color}`}
              onClick={() => handleColor(color)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: color,
                border: state.site.accentColor === color ? '3px solid #111' : '3px solid transparent',
                outline: '1px solid #dfe6e2',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <strong>Live website preview</strong>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#71807a' }}>
              Published content rendered with the active theme.
            </p>
          </div>
          <span className="badge">Live</span>
        </div>
        <div style={{ border: '1px solid #dfe6e2', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
          <iframe
            key={`${state.site.themeId}-${state.site.accentColor}-${state.site.siteSlug}`}
            src={previewUrl}
            title="Live website preview"
            style={{ width: '100%', height: 520, border: 0, display: 'block' }}
          />
        </div>
      </section>
    </div>
  );
}
