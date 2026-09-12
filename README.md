# Buildora

Buildora is an AI-powered website builder for quickly generating, editing, publishing and growing a complete website.

## Hackathon experience

- Full-stack Next.js application
- Turso/libSQL persistence
- AI website generation with Mistral
- Eight visual themes
- Visual section builder with drag-and-drop ordering
- Hero, Features, About, Services, CTA, Testimonials, FAQ, Gallery and Contact sections
- Backend-persisted reusable page layouts
- Rich-text page and post editing
- AI writing + rewrite modes
- Automatic page version history and restore
- Page, post and whole-site duplication
- Multi-site workspace manager
- Media uploads and post cover images
- Contact, newsletter and booking forms
- Turso-backed form submissions inbox + CSV export
- Google Analytics, WhatsApp, Calendly, Mailchimp and Paystack integration settings
- Public WhatsApp, Calendly and Paystack actions
- Public site publishing and live previews
- Deterministic polished demo seeder
- Responsive dashboard and visual builder

## Main demo flow

1. Enter Buildora and create or select a website.
2. Describe a business and let Mistral generate the starter website, theme, SEO and starter blog posts.
3. Choose from eight themes and adjust brand colour.
4. Edit pages manually or use AI title, draft, SEO and rewrite controls.
5. Open the visual builder, add sections, drag blocks into order, and save reusable layouts.
6. Restore earlier page versions if needed.
7. Upload images and choose post cover media.
8. Create a contact, newsletter or booking form and publish its landing page automatically.
9. Submit the public form and review the response in the Turso-backed inbox.
10. Connect WhatsApp, Calendly, Analytics, Mailchimp or Paystack.
11. Duplicate content or clone the entire website.
12. Open the published site.

## Stack

- Next.js 14
- React 18
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

Buildora auto-creates the lightweight hackathon tables it requires on first use. `/api/health` verifies the database connection and initializes the schema.

## Verification note

The feature branch stays in a draft pull request until a full runtime click-through is available. GitHub Actions currently fails before allocating a runner, so development has included static route, persistence, responsive and cross-feature audits while functionality continues to be built.
