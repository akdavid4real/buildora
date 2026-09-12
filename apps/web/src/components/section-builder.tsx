'use client';

import { GripVertical, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

type EditorLike = {
  getJSON: () => { type?: string; content?: Array<Record<string, unknown>> };
  commands: { setContent: (content: unknown) => void };
};

const SECTION_LIBRARY = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'Strong headline, supporting copy and call to action.',
    nodes: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'A clearer way to tell your story' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Introduce what you do, who it is for, and why it matters in one confident message.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Get started today.' }] },
    ],
  },
  {
    id: 'features',
    name: 'Features',
    description: 'Three simple reasons customers should choose you.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why people choose us' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Built around your real needs.' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Simple, reliable and easy to understand.' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A human experience from start to finish.' }] }] },
      ] },
    ],
  },
  {
    id: 'about',
    name: 'About',
    description: 'Tell visitors who you are and what you believe.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'About us' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'We started with a simple belief: good work should feel clear, useful and personal. Today we help our customers move forward with confidence.' }] },
    ],
  },
  {
    id: 'services',
    name: 'Services',
    description: 'Present your core offers in a scannable format.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What we can help you with' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Service one' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Explain the first core service and the outcome it creates.' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Service two' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Explain another useful service in clear customer language.' }] },
    ],
  },
  {
    id: 'cta',
    name: 'CTA',
    description: 'A focused call to action for the next step.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ready to take the next step?' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tell visitors exactly what to do next and make the decision feel easy.' }] },
    ],
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    description: 'Add social proof and customer trust.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What our customers say' }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '“Working with this team made the whole process feel simple and genuinely thoughtful.”' }] }] },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Answer common questions before visitors need to ask.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Frequently asked questions' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'How does it work?' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Give a short, reassuring explanation of your process.' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'How do I get started?' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Explain the easiest next step for a new customer.' }] },
    ],
  },
  {
    id: 'gallery',
    name: 'Gallery',
    description: 'Create a visual showcase placeholder for your media.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A closer look' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Use your Media library to add project, product or brand imagery here.' }] },
    ],
  },
  {
    id: 'contact',
    name: 'Contact',
    description: 'Give visitors a clear way to reach you.',
    nodes: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Let’s talk' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tell visitors how to reach you, what information to include, and when they can expect a reply.' }] },
    ],
  },
] as const;

function nodeLabel(node: Record<string, unknown>, index: number) {
  const content = Array.isArray(node.content) ? node.content as Array<Record<string, unknown>> : [];
  const firstText = content.find((item) => typeof item.text === 'string')?.text;
  if (typeof firstText === 'string' && firstText.trim()) return firstText.slice(0, 54);
  const type = typeof node.type === 'string' ? node.type : 'section';
  return `${type.replace(/([A-Z])/g, ' $1')} ${index + 1}`;
}

export function SectionBuilder({
  editor,
  onChanged,
}: {
  editor: EditorLike | null;
  onChanged?: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const nodes = useMemo(() => editor?.getJSON().content ?? [], [editor, editor?.getJSON().content?.length]);

  const setNodes = (nextNodes: Array<Record<string, unknown>>) => {
    if (!editor) return;
    editor.commands.setContent({ type: 'doc', content: nextNodes });
    onChanged?.();
  };

  const addSection = (section: (typeof SECTION_LIBRARY)[number]) => {
    if (!editor) return;
    const current = editor.getJSON().content ?? [];
    setNodes([...current, ...section.nodes.map((node) => structuredClone(node))]);
  };

  const reorder = (from: number, to: number) => {
    if (!editor || from === to) return;
    const current = [...(editor.getJSON().content ?? [])];
    const [moved] = current.splice(from, 1);
    if (!moved) return;
    current.splice(to, 0, moved);
    setNodes(current);
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="panel-title" style={{ marginBottom: 12 }}>Section builder</div>
      <p style={{ fontSize: 13, color: '#6f7c77', marginTop: 0 }}>
        Add ready-made website sections, then drag the existing content blocks into the order you want.
      </p>

      <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
        {SECTION_LIBRARY.map((section) => (
          <button
            type="button"
            key={section.id}
            className="btn btn-secondary"
            style={{ justifyContent: 'space-between', textAlign: 'left', height: 'auto', padding: '9px 11px' }}
            onClick={() => addSection(section)}
            disabled={!editor}
          >
            <span>
              <strong style={{ display: 'block', fontSize: 13 }}>{section.name}</strong>
              <small style={{ color: '#71807a' }}>{section.description}</small>
            </span>
            <Plus size={15} />
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#53615c', marginBottom: 8 }}>
        CURRENT BLOCKS
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {(editor?.getJSON().content ?? []).map((node, index) => (
          <div
            key={`${index}-${String(node.type)}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #e1e8e4',
              background: dragIndex === index ? '#eef5f1' : '#fff',
              cursor: 'grab',
              fontSize: 12,
              color: '#435850',
            }}
          >
            <GripVertical size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nodeLabel(node, index)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
