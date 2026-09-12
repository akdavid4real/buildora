'use client';

import { Check } from 'lucide-react';
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

  return (
    <div className="content">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Appearance</span>
          <h2>Choose your site’s personality</h2>
          <p>Instantly changes the look and styling of your live public website.</p>
        </div>
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
              <div className={`theme-preview ${theme.className}`}>
                <small>BUILDORA</small>
                <b>Stories worth sharing.</b>
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
    </div>
  );
}
