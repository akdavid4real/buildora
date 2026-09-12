'use client';

import { Download, ExternalLink, Inbox, Plus, Power, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDemo } from '../lib/demo-context';

type SiteForm = {
  id: string;
  type: 'contact' | 'newsletter' | 'booking';
  title: string;
  pageSlug: string;
  enabled: boolean;
};

type Submission = {
  id: string;
  formId: string;
  formType: string;
  payload: Record<string, string>;
  createdAt: string;
};

export function FormsView() {
  const { currentSite, state, showNotice } = useDemo();
  const searchParams = useSearchParams();
  const requestedPageSlug = searchParams.get('pageSlug')?.trim() || '';
  const [forms, setForms] = useState<SiteForm[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [type, setType] = useState<SiteForm['type']>('contact');
  const [pageSlug, setPageSlug] = useState(requestedPageSlug);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (requestedPageSlug) setPageSlug(requestedPageSlug);
  }, [requestedPageSlug]);

  const load = async () => {
    if (!currentSite) return;
    const [formsRes, submissionsRes] = await Promise.all([
      fetch(`/api/sites/${currentSite.id}/forms`),
      fetch(`/api/sites/${currentSite.id}/submissions`),
    ]);
    if (formsRes.ok) setForms((await formsRes.json()).forms || []);
    if (submissionsRes.ok) setSubmissions((await submissionsRes.json()).data || []);
  };

  useEffect(() => {
    void load();
  }, [currentSite?.id]);

  const createForm = async () => {
    if (!currentSite) return;
    setLoading(true);
    try {
      const fallbackSlug = type === 'newsletter' ? 'newsletter' : type === 'booking' ? 'booking' : 'contact';
      const targetPageSlug = (pageSlug || fallbackSlug).replace(/^\/+|\/+$/g, '');
      const response = await fetch(`/api/sites/${currentSite.id}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pageSlug: targetPageSlug }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to create form');
      await load();
      showNotice(`Form connected to /${targetPageSlug}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to create form');
    } finally {
      setLoading(false);
    }
  };

  const patchForm = async (form: SiteForm, patch: Partial<SiteForm>) => {
    if (!currentSite) return;
    const next = { ...form, ...patch };
    setForms((items) => items.map((item) => item.id === form.id ? next : item));
    const response = await fetch(`/api/sites/${currentSite.id}/forms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: form.id, ...patch }),
    });
    if (!response.ok) {
      await load();
      showNotice('Unable to update form');
    } else {
      showNotice(next.enabled ? 'Form is live' : 'Form paused');
    }
  };

  const removeForm = async (id: string) => {
    if (!currentSite) return;
    const response = await fetch(`/api/sites/${currentSite.id}/forms?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      showNotice('Unable to remove form');
      return;
    }
    setForms((items) => items.filter((item) => item.id !== id));
    showNotice('Form removed');
  };

  const exportCsv = () => {
    const rows = submissions.map((submission) => ({
      type: submission.formType,
      createdAt: submission.createdAt,
      ...submission.payload,
    }));
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `buildora-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Lead capture</span>
          <h2>Forms</h2>
          <p>Create contact, newsletter, and booking forms. Responses are stored in Turso.</p>
          {requestedPageSlug && (
            <p style={{ marginTop: 8, fontSize: 13, color: '#526960' }}>
              Visual builder handoff: attach this form to <strong>/{requestedPageSlug}</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'grid', gap: 8, minWidth: 260 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as SiteForm['type'])}>
              <option value="contact">Contact form</option>
              <option value="newsletter">Newsletter signup</option>
              <option value="booking">Booking enquiry</option>
            </select>
            <button className="btn btn-primary" onClick={createForm} disabled={loading || !currentSite}>
              <Plus size={15} /> {loading ? 'Creating…' : 'Create form'}
            </button>
          </div>
          <input
            className="input"
            value={pageSlug}
            onChange={(e) => setPageSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
            placeholder="Landing page slug, e.g. contact"
            aria-label="Form landing page slug"
          />
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Forms</h3>
          {forms.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>No forms yet. Create one above and Buildora will publish its landing page automatically.</div>
          ) : (
            <div className="activity">
              {forms.map((form) => (
                <div className="activity-row" key={form.id} style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{form.title}</strong>
                    <small>/{form.pageSlug} · {form.type}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <a className="btn btn-secondary" style={{ padding: '6px 8px' }} href={`/site/${state.site.siteSlug}/${form.pageSlug}`} target="_blank" rel="noopener noreferrer" title="Open live form">
                      <ExternalLink size={13} />
                    </a>
                    <button className={form.enabled ? 'btn btn-soft' : 'btn btn-secondary'} style={{ padding: '6px 9px', fontSize: 12 }} onClick={() => patchForm(form, { enabled: !form.enabled })}>
                      <Power size={13} /> {form.enabled ? 'Live' : 'Paused'}
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 8px' }} onClick={() => removeForm(form.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div className="panel-title" style={{ margin: 0 }}><Inbox size={16} /> Recent submissions</div>
            {submissions.length > 0 && (
              <button className="btn btn-secondary" style={{ padding: '6px 9px', fontSize: 12 }} onClick={exportCsv}>
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
          {submissions.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>No responses yet. Open a live form and submit a test response.</div>
          ) : (
            <div className="activity">
              {submissions.map((submission) => (
                <div className="activity-row" key={submission.id} style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{submission.formType}</strong>
                    <small>{new Date(submission.createdAt).toLocaleString()}</small>
                    <div style={{ marginTop: 7, fontSize: 12, color: '#526960', wordBreak: 'break-word' }}>
                      {Object.entries(submission.payload).slice(0, 6).map(([key, value]) => (
                        <div key={key}><b>{key}:</b> {value}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
