# Buildora

Buildora is an AI-powered website builder built for fast creation, editing and publishing.

## Current hackathon experience

- Full-stack Next.js application
- Turso/libSQL persistence
- AI website generation with Mistral
- Eight visual themes
- Visual section builder with drag-and-drop ordering
- Reusable saved page layouts
- Rich-text editing
- AI rewrite modes
- Page duplication
- Whole-site duplication
- Page version snapshots and restore
- Media uploads and post cover images
- Public site publishing
- Live previews

## Main demo flow

1. Open Buildora and enter the workspace.
2. Describe a business and let AI generate the starter website.
3. Choose from eight themes and adjust the brand colour.
4. Edit pages manually or use AI writing and rewrite controls.
5. Open the visual builder, add sections, drag blocks into order, and save reusable layouts.
6. Save page snapshots before major edits and restore an earlier version when needed.
7. Duplicate pages or clone an entire site.
8. Upload media, choose a post cover image and publish content.
9. Open the live public website.

## Stack

- Next.js
- React
- TypeScript
- Prisma
- Turso / libSQL
- Tiptap
- Mistral AI

## Environment

```env
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."
MISTRAL_API_KEY="..."
MISTRAL_MODEL="mistral-small-latest"
NEXT_PUBLIC_API_URL="/api"
```

The application auto-creates the lightweight hackathon tables it requires on first use.
