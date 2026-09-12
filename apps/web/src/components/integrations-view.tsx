'use client';

import { BarChart3, CalendarDays, CheckCircle2, CreditCard, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDemo } from '../lib/demo-context';

type Config = Record<string, { enabled: boolean; value?: string }>;

const ITEMS = [
  { id: 'google-analytics', name: 'Google Analytics', icon: BarChart3, placeholder: 'G-XXXXXXXXXX', help: 'Measurement ID for traffic analytics.' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, placeholder: '+2348012345678', help: 'Business number used for click-to-chat.' },
  { id: 'calendly', name: 'Calendly', icon: CalendarDays, placeholder: 'https://calendly.com/your-link', help: 'Booking link for appointments.' },
  { id: 'mailchimp', name: 'Mailchimp', icon: Send, placeholder: 'https://... signup URL', help: 'Hosted newsletter signup URL.' },
  { id: 'paystack', name: 'Paystack', icon: CreditCard, placeholder: 'https://paystack.com/pay/...', help: 'Payment page for simple checkout links.' },
] as const;

function validValue(provider: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (provider === 'google-analytics') return /^G-[A-Z0-9]+$/i.test(trimmed);
  if (provider === 'whatsapp') return trimmed.replace(/\D/g, '').length >= 10;
  return /^https:\/\//i.test(trimmed);
}

export function IntegrationsView() {
  const { currentSite, state, showNotice } = useDemo();
  const [config, setConfig] = useState<Config>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSite) return;
    fetch(`/api/sites/${currentSite.id}/integrations`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setConfig(payload?.integrations || {}))
      .catch(() => undefined);
  }, [currentSite?.id]);

  const save = async (provider: string) => {
    if (!currentSite) return;
    const current = config[provider] || { enabled: false, value: '' };
    if (current.enabled && !validValue(provider, current.value || '')) {
      showNotice(provider === 'google-analytics' ? 'Enter a valid G- measurement ID' : provider === 'whatsapp' ? 'Enter a valid WhatsApp number' : 'Enter a full https:// URL');
      return;
    }
    setSaving(provider);
    try {
      const response = await fetch(`/api/sites/${currentSite.id}/integrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, enabled: current.enabled, value: current.value || '' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to save integration');
      setConfig(payload.integrations || {});
      showNotice('Integration saved');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to save integration');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Connections</span>
          <h2>Integrations</h2>
          <p>Connect the tools a small business is most likely to use during a live demo.</p>
        </div>
        <a className="btn btn-secondary" href={`/site/${state.site.siteSlug}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> Preview site
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        {ITEMS.map(({ id, name, icon: Icon, placeholder, help }) => {
          const item = config[id] || { enabled: false, value: '' };
          const valid = !item.enabled || validValue(id, item.value || '');
          return (
            <section className="card" key={id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div className="panel-title" style={{ margin: 0 }}><Icon size={17} /> {name}</div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700 }}>
                  <input type="checkbox" checked={Boolean(item.enabled)} onChange={(e) => setConfig((prev) => ({ ...prev, [id]: { ...item, enabled: e.target.checked } }))} />
                  {item.enabled ? 'Enabled' : 'Disabled'}
                </label>
              </div>
              <p style={{ color: '#6f7c77', fontSize: 13 }}>{help}</p>
              <input className="input" placeholder={placeholder} value={item.value || ''} onChange={(e) => setConfig((prev) => ({ ...prev, [id]: { ...item, value: e.target.value } }))} style={!valid ? { borderColor: '#d66' } : undefined} />
              {!valid && <small style={{ color: '#a33', display: 'block', marginTop: 6 }}>Check this value before saving.</small>}
              <button className="btn btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => save(id)} disabled={saving === id}>
                {item.enabled ? <CheckCircle2 size={14} /> : null}
                {saving === id ? 'Saving…' : 'Save integration'}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
