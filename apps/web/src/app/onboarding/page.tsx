'use client';

import { Check, ChevronRight, Loader2, Palette, Sparkles, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDemo } from '../../lib/demo-context';
import type { ThemeId } from '../../lib/types';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const THEMES: Array<{ id: ThemeId; name: string; description: string }> = [
  { id: 'minimal-blog', name: 'Minimal Blog', description: 'Editorial and content-first.' },
  { id: 'small-business', name: 'Small Business', description: 'Professional and conversion-ready.' },
  { id: 'personal-portfolio', name: 'Portfolio', description: 'Creative and personality-led.' },
];

const EXAMPLES = [
  'I run a premium skincare brand in Lagos for young professionals who want simple healthy routines.',
  'I am a product designer building a personal portfolio to attract international startup clients.',
  'We are a consulting firm helping Nigerian SMEs improve operations, leadership and workplace culture.',
];

export default function OnboardingPage() {
  const { state, updateState, hydrated, currentSite, refreshData, showNotice, isApiMode } = useDemo();
  const router = useRouter();
  const [name, setName] = useState(state.site.siteName === 'My Buildora Site' ? '' : state.site.siteName);
  const [tagline, setTagline] = useState(state.site.tagline || '');
  const [themeId, setThemeId] = useState<ThemeId>(state.site.themeId);
  const [accentColor, setAccentColor] = useState(state.site.accentColor || '#174d3e');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
    setAiError(null);
    if (!isApiMode || !currentSite) {
      setAiError('Connect Buildora to its database first, then AI can generate and save your site.');
      return;
    }
    if (description.trim().length < 10) {
      setAiError('Tell Buildora a little more about the business or website you want.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/ai/generate-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; generated?: { siteName?: string; tagline?: string; themeId?: ThemeId; accentColor?: string } }
        | null;

      if (!response.ok) throw new Error(data?.message || 'AI website generation failed');

      await refreshData();
      showNotice('AI built your starter website');
      router.push('/dashboard');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Unable to generate website');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7f5', padding: '48px 20px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <span className="brand" style={{ justifyContent: 'center', color: '#173f35' }}>
            <span className="brand-mark">B</span> Buildora
          </span>
          <span className="eyebrow" style={{ display: 'block', marginTop: 24 }}>Build your website</span>
          <h1 style={{ fontSize: 38, margin: '8px 0' }}>Start with an idea. Let Buildora do the rest.</h1>
          <p style={{ color: '#6f7c77', margin: 0 }}>
            Generate a complete starter site with AI, or customize the basics yourself.
          </p>
        </div>

        <div className="ai-card" style={{ padding: 28, marginBottom: 22 }}>
          <div className="panel-title" style={{ fontSize: 18 }}>
            <WandSparkles size={20} /> Build my site with AI
          </div>
          <p style={{ margin: '8px 0 18px' }}>
            Describe the business, audience and what the site should achieve. Buildora will create the
            brand direction, homepage, About page, Services page, SEO and starting theme.
          </p>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: I run a Lagos skincare brand for young professionals. I want a premium but friendly site that explains our products and builds trust."
            style={{ minHeight: 115, background: 'white' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0 18px' }}>
            {EXAMPLES.map((example, index) => (
              <button
                type="button"
                key={index}
                className="btn btn-soft"
                style={{ fontSize: 12 }}
                onClick={() => setDescription(example)}
                disabled={generating}
              >
                Example {index + 1}
              </button>
            ))}
          </div>
          {aiError && (
            <div style={{ color: '#9e2a2b', fontSize: 13, marginBottom: 12 }}>{aiError}</div>
          )}
          <button
            className="btn btn-primary"
            type="button"
            onClick={generateSite}
            disabled={generating}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Building your website...' : 'Generate my website with AI'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#87948f' }}>
          <span style={{ flex: 1, height: 1, background: '#dfe6e2' }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>or set it up manually</span>
          <span style={{ flex: 1, height: 1, background: '#dfe6e2' }} />
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="settings-grid">
            <div className="field">
              <label>Website / business name</label>
              <input
                className="input"
                placeholder="e.g. Northstar Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Tagline</label>
              <input
                className="input"
                placeholder="What do you help people do?"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div className="panel-title" style={{ marginBottom: 12 }}>
              <Palette size={17} /> Choose a starting style
            </div>
            <div className="themes">
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.id}
                  className={`theme ${themeId === theme.id ? 'selected' : ''}`}
                  onClick={() => setThemeId(theme.id)}
                >
                  <div className={`theme-preview ${theme.id === 'small-business' ? 'business' : theme.id === 'personal-portfolio' ? 'portfolio' : ''}`}>
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
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{ width: 58, height: 44, border: '1px solid #dfe6e2', borderRadius: 9, padding: 3 }}
              />
              <span style={{ fontFamily: 'monospace', color: '#53615c' }}>{accentColor}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid #e5ebe8' }}>
            <div style={{ color: '#71807a', fontSize: 13, display: 'flex', gap: 7, alignItems: 'center' }}>
              <Sparkles size={15} /> You can change everything later.
            </div>
            <button className="btn btn-primary" onClick={finish}>
              Build my site <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
