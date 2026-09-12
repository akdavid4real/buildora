'use client';

import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type SavedTemplate = {
  id: string;
  name: string;
  nodes: Array<Record<string, unknown>>;
};

const STORAGE_KEY = 'buildora-reusable-sections-v1';

export function ReusableSections({
  getNodes,
  onInsert,
}: {
  getNodes: () => Array<Record<string, unknown>>;
  onInsert: (nodes: Array<Record<string, unknown>>) => void;
}) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {
      setTemplates([]);
    }
  }, []);

  const persist = (next: SavedTemplate[]) => {
    setTemplates(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const saveCurrent = () => {
    const nodes = getNodes();
    if (!nodes.length) return;
    const name = window.prompt('Name this reusable section or layout:', 'My reusable section');
    if (!name?.trim()) return;
    persist([
      { id: crypto.randomUUID(), name: name.trim(), nodes: structuredClone(nodes) },
      ...templates,
    ]);
  };

  return (
    <div className="card" style={{ padding: 18, marginTop: 14 }}>
      <div className="panel-title">Reusable sections</div>
      <p style={{ fontSize: 12, color: '#6f7c77' }}>
        Save the current page blocks as a reusable template and drop them into another page later.
      </p>
      <button className="btn btn-secondary" type="button" onClick={saveCurrent} style={{ width: '100%' }}>
        <Save size={14} /> Save current layout
      </button>

      {templates.length > 0 && (
        <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
          {templates.map((template) => (
            <div key={template.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {template.name}
              </span>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ padding: '6px 8px' }}
                onClick={() => onInsert(structuredClone(template.nodes))}
                title="Insert reusable section"
              >
                <Plus size={13} />
              </button>
              <button
                className="btn btn-danger"
                type="button"
                style={{ padding: '6px 8px' }}
                onClick={() => persist(templates.filter((item) => item.id !== template.id))}
                title="Delete reusable section"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
