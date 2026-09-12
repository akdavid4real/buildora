'use client';

import { Inbox, Plus, Trash2 } from 'lucide-react';
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
  const { currentSite, showNotice } = useDemo();
  const [forms, setForms] = useState<SiteForm[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [type, setType] = useState<SiteForm['type']>('contact');
  const [loading, setLoading] = useState(false);

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
      const response = await fetch(`/api/sites/${currentSite.id}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pageSlug: type === 'newsletter' ? 'newsletter' : type === 'booking' ? 'booking' : 'contact' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to create form');
      await load();
      showNotice('Form created');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to create form');
    } finally {
      setLoading(false);
    }
  };

  const removeForm = async (id: string) => {
    if (!currentSite) return;
    await fetch(`/api/sites/${currentSite.id}/forms?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setForms((items) => items.filter((item) => item.id !== id));
    showNotice('Form removed');
  };

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Lead capture</span>
          <h2>Forms</h2>
          <p>Create contact, newsletter, and booking forms. Responses are stored in Turso.</p>
        </div>
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
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Active forms</h3>
          {forms.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>No forms yet.</div>
          ) : (
            <div className="activity">
              {forms.map((form) => (
                <div className="activity-row" key={form.id}>
                  <div>
                    <strong>{form.title}</strong>
                    <small>/{form.pageSlug} · {form.type}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge">{form.enabled ? 'Live' : 'Off'}</span>
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
          <div className="panel-title"><Inbox size={16} /> Recent submissions</div>
          {submissions.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>No responses yet.</div>
          ) : (
            <div className="activity">
              {submissions.map((submission) => (
                <div className="activity-row" key={submission.id} style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{submission.formType}</strong>
                    <small>{new Date(submission.createdAt).toLocaleString()}</small>
                    <div style={{ marginTop: 7, fontSize: 12, color: '#526960' }}>
                      {Object.entries(submission.payload).slice(0, 4).map(([key, value]) => (
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
