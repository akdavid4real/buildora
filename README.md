# Buildora

Buildora is a lightweight AI-powered website builder and CMS for brochure websites, blogs, and hackathon-ready site creation.

> Current hackathon direction: full-stack Next.js + Turso/libSQL + Mistral AI.

## Current highlights

- AI website generator from a short business description.
- 8 visual themes: Minimal Blog, Small Business, Personal Portfolio, Agency, Restaurant, SaaS, Event, Personal Brand.
- Visual section builder with drag-and-drop content reordering.
- Section library: Hero, Features, About, Services, CTA, Testimonials, FAQ, Gallery, Contact.
- Rich-text page and post editing.
- AI title, draft, SEO, and rewrite controls.
- Rewrite modes: Professional, Friendly, Shorter, Longer, SEO optimized, Nigerian audience.
- Persistent media library and blog cover images.
- Live public-site preview and publishing.
- Turso-backed storage with hackathon bootstrap logic.

## Core stack

- Next.js / React
- Turborepo + Bun
- Prisma + libSQL/Turso
- Mistral AI
- Tiptap
- Tailwind CSS

## Hackathon priority

Functionality and demo impact come first. The core flow is:

`login → setup or AI generate → edit → AI assist → media → visual builder → publish → live site`
