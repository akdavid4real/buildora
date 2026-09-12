'use client';

import { History, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

type Version = {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
};

export function VersionHistory({
  siteId,
  pageId,
  onRestored,
}: {
  siteId: string;
  pageId: string;
  onRestored: () => Promise<void> | void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/pages/${pageId}/versions`);
      if (response.ok) setVersions(await response.json());
    } catch {}
  };

  useEffect(() => {
    load();
  }, [siteId, pageId]);

  const snapshot = async () => {
    setBusy(true);
    try {
      await fetch(`/api/sites/${siteId}/pages/${pageId}/versions`, { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!window.confirm('Restore this version? Current page content will be replaced.')) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/sites/${siteId}/pages/${pageId}/versions/${versionId}/restore`,
        { method: 'POST' },
      );
      if (response.ok) await onRestored();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="panel-title"><History size={16} /> Version history</div>
      <p style={{ fontSize: 12, color: '#6f7c77' }}>
        Save snapshots before major edits and restore any of the last 20 versions.
      </p>
      <button className="btn btn-secondary" type="button" onClick={snapshot} disabled={busy} style={{ width: '100%' }}>
        <Save size={14} /> {busy ? 'Working…' : 'Save snapshot'}
      </button>
      {versions.length > 0 && (
        <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
          {versions.map((version) => (
            <div key={version.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #edf0ee' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 12 }}>{version.title}</strong>
                <small style={{ color: '#71807a' }}>{new Date(version.createdAt).toLocaleString()}</small>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => restore(version.id)} disabled={busy} title="Restore version" style={{ padding: '6px 8px' }}>
                <RotateCcw size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
