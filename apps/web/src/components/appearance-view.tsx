'use client';

import { Check, ExternalLink } from 'lucide-react';
import React from 'react';
import { useDemo } from '../lib/demo-context';
import type { ThemeId } from '../lib/types';

const THEMES: { id: ThemeId; name: string; description: string }[] = [
  { id: 'minimal-blog', name: 'Minimal Blog', description: 'Editorial, spacious and content-first typography.' },
  { id: 'small-business', name: 'Small Business', description: 'Confident, welcoming and conversion-ready.' },
  { id: 'personal-portfolio', name: 'Personal Portfolio', description: 'Warm, creative and personality-led.' },
  { id: 'agency', name: 'Agency', description: 'Bold, sharp and designed to sell expertise.' },
  { id: 'restaurant', name: 'Restaurant', description: 'Rich, atmospheric and hospitality-focused.' },
  { id: 'saas', name: 'SaaS', description: 'Clean product-led styling with modern contrast.' },
  { id: 'event', name: 'Event', description: 'Energetic, urgent and built around attendance.' },
  { id: 'personal-brand', name: 'Personal Brand', description: 'Confident, expressive and creator-friendly.' },
];

const PRESET_COLORS = ['#174d3e', '#2563eb', '#7c3aed', '#c2410c', '#be123c', '#111827'];

const previewStyle = (themeId: ThemeId, accent: string): React.CSSProperties => {
  const base: React.CSSProperties = { '--green': accent } as React.CSSProperties;
  switch (themeId) {
    case 'small-business': return { ...base, background: '#f4fbf8', color: '#184a3c', borderColor: '#d4e9df' };
    case 'personal-portfolio': return { ...base, background: '#efe6db', color: '#402f27' };
    case 'agency': return { ...base, background: '#0f172a', color: '#f8fafc', borderColor: '#1e293b' };
    case 'restaurant': return { ...base, background: 'linear-gradient(145deg,#2b1b15,#6b3f2a)', color: '#fff4e6', borderColor: '#8b5a3c' };
    case 'saas': return { ...base, background: 'linear-gradient(145deg,#eef4ff,#ffffff)', color: '#1d4ed8', borderColor: '#bfd1ff' };
    case 'event': return { ...base, background: 'linear-gradient(145deg,#3b0764,#7e22ce)', color: '#f5e9ff', borderColor: '#a855f7' };
    case 'personal-brand': return { ...base, background: 'linear-gradient(145deg,#fff1f2,#fff7ed)', color: '#9f1239', borderColor: '#fecdd3' };
    default: return { ...base, background: '#fffdfa', color: '#24332e', borderColor: '#e7dfd4' };
  }
};

export function AppearanceView() {
  const { state, updateState } = useDemo();

  const handleSelectTheme = (themeId: ThemeId, themeName: string) => {
    updateState({ ...state, site: { ...state.site, themeId } }, `${themeName} applied`);
  };

  const handleColor = (accentColor: string) => {
    updateState({ ...state, site: { ...state.site, accentColor } });
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
            <button key={theme.id} className={`theme ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectTheme(theme.id, theme.name)} type="button">
              <div className="theme-preview" style={previewStyle(theme.id, state.site.accentColor)}>
                <small>{state.site.siteName.toUpperCase()}</small>
                <b>{state.site.tagline || 'Stories worth sharing.'}</b>
                <span />
                <span />
              </div>
              <strong>{theme.name}</strong>
              <p style={{ color: '#71807a', fontSize: 13 }}>{theme.description}</p>
              {isSelected && <span className="badge"><Check size={11} style={{ marginRight: 4 }} /> Active</span>}
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
          <input type="color" value={state.site.accentColor} onChange={(e) => handleColor(e.target.value)} aria-label="Custom accent colour" style={{ width: 52, height: 42, padding: 3, borderRadius: 9, cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((color) => (
            <button key={color} type="button" aria-label={`Use ${color}`} onClick={() => handleColor(color)} style={{ width: 38, height: 38, borderRadius: 999, background: color, border: state.site.accentColor === color ? '3px solid #111' : '3px solid transparent', outline: '1px solid #dfe6e2', cursor: 'pointer' }} />
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <strong>Live website preview</strong>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#71807a' }}>Published content rendered with the active theme.</p>
          </div>
          <span className="badge">Live</span>
        </div>
        <div style={{ border: '1px solid #dfe6e2', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
          <iframe key={`${state.site.themeId}-${state.site.accentColor}-${state.site.siteSlug}`} src={previewUrl} title="Live website preview" style={{ width: '100%', height: 520, border: 0, display: 'block' }} />
        </div>
      </section>
    </div>
  );
}
