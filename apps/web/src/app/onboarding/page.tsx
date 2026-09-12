'use client';

import { Check, ChevronRight, Palette, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDemo } from '../../lib/demo-context';
import type { ThemeId } from '../../lib/types';

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const THEMES: Array<{ id: ThemeId; name: string; description: string; className: string }> = [
  { id: 'minimal-blog', name: 'Minimal Blog', description: 'Editorial and content-first.', className: '' },
  { id: 'small-business', name: 'Small Business', description: 'Professional and conversion-ready.', className: 'business' },
  { id: 'personal-portfolio', name: 'Portfolio', description: 'Creative and personality-led.', className: 'portfolio' },
  { id: 'agency', name: 'Agency', description: 'Bold and expertise-led.', className: 'agency' },
  { id: 'restaurant', name: 'Restaurant', description: 'Warm and hospitality-focused.', className: 'restaurant' },
  { id: 'saas', name: 'SaaS', description: 'Clean, modern and product-led.', className: 'saas' },
  { id: 'event', name: 'Event', description: 'Energetic and attendance-focused.', className: 'event' },
  { id: 'personal-brand', name: 'Personal Brand', description: 'Confident and creator-friendly.', className: 'personal-brand' },
];

export default function OnboardingPage() {
  const { state, updateState, hydrated, currentSite, refreshData } = useDemo();
  const router = useRouter();
  const [name, setName] = useState(state.site.siteName === 'My Buildora Site' ? '' : state.site.siteName);
  const [tagline, setTagline] = useState(state.site.tagline || '');
  const [themeId, setThemeId] = useState<ThemeId>(state.site.themeId);
  const [accentColor, setAccentColor] = useState(state.site.accentColor || '#174d3e');
  const [businessDescription, setBusinessDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) return null;

  const finish = () => {
    const siteName = name.trim() || 'My Buildora Site';
    updateState(
      {
        ...state,
        site: {
          ...state.site,
          siteName,
          siteSlug: slugify(siteName) || state.site.siteSlug,
          tagline: tagline.trim() || 'A better website, built simply.',
          themeId,
          accentColor,
        },
      },
      'Your site is ready',
    );
    router.push('/dashboard');
  };

  const generateSite = async () => {
    if (!currentSite || !businessDescription.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/ai/generate-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: businessDescription.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to generate website');
      await refreshData();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate website');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7f5', padding: '48px 20px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <span className="brand" style={{ justifyContent: 'center', color: '#173f35' }}>
            <span className="brand-mark">B</span> Buildora
          </span>
          <span className="eyebrow" style={{ display: 'block', marginTop: 24 }}>Quick setup</span>
          <h1 style={{ fontSize: 38, margin: '8px 0' }}>Make this website yours.</h1>
          <p style={{ color: '#6f7c77', margin: 0 }}>Describe your business and let AI build the first version, or set it up manually.</p>
        </div>

        <div className="ai-card" style={{ padding: 24, marginBottom: 22 }}>
          <div className="panel-title"><Sparkles size={18} /> Generate my website with AI</div>
          <p>Example: “I run a Lagos skincare brand for young women focused on simple routines and natural ingredients.”</p>
          <textarea className="textarea" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} placeholder="Tell Buildora what your business does, who it serves, and the feeling you want the website to have..." />
          {error && <p style={{ color: '#9e2a2b', marginTop: 8 }}>{error}</p>}
          <button className="btn btn-primary" onClick={generateSite} disabled={generating || !businessDescription.trim()}>
            <Sparkles size={16} /> {generating ? 'Building your website...' : 'Generate complete starter site'}
          </button>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="settings-grid">
            <div className="field">
              <label>Website / business name</label>
              <input className="input" autoFocus placeholder="e.g. Northstar Studio" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Tagline</label>
              <input className="input" placeholder="What do you help people do?" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div className="panel-title" style={{ marginBottom: 12 }}><Palette size={17} /> Choose a starting style</div>
            <div className="themes">
              {THEMES.map((theme) => (
                <button type="button" key={theme.id} className={`theme ${themeId === theme.id ? 'selected' : ''}`} onClick={() => setThemeId(theme.id)}>
                  <div className={`theme-preview ${theme.className}`}>
                    <small>BUILDORA</small>
                    <b>{name || 'Your website'}</b>
                    <span />
                    <span />
                  </div>
                  <strong>{theme.name}</strong>
                  <p style={{ color: '#71807a', fontSize: 13 }}>{theme.description}</p>
                  {themeId === theme.id && <span className="badge"><Check size={11} /> Selected</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 10 }}>Accent colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 58, height: 44, border: '1px solid #dfe6e2', borderRadius: 9, padding: 3 }} />
              <span style={{ fontFamily: 'monospace', color: '#53615c' }}>{accentColor}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid #e5ebe8' }}>
            <div style={{ color: '#71807a', fontSize: 13, display: 'flex', gap: 7, alignItems: 'center' }}><Sparkles size={15} /> Pages, posts and AI tools are ready next.</div>
            <button className="btn btn-primary" onClick={finish}>Build my site <ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </main>
  );
}
