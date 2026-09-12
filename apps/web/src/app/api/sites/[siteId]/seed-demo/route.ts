import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../../server/hackathon';

function doc(title: string, sections: Array<{ heading?: string; body: string }>) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
      ...sections.flatMap((section) => [
        ...(section.heading ? [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: section.heading }] }] : []),
        { type: 'paragraph', content: [{ type: 'text', text: section.body }] },
      ]),
    ],
  };
}

export async function POST(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const themeConfig = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};

    await prisma.$transaction(async (tx) => {
      await tx.site.update({
        where: { id: site.id },
        data: {
          name: 'Northstar Studio',
          themeId: 'agency',
          themeConfig: {
            ...themeConfig,
            tagline: 'Strategy, design, and digital experiences that move brands forward.',
            accentColor: '#2563eb',
            seoTitle: 'Northstar Studio — Strategy & Digital Experiences',
            seoDescription: 'A modern creative studio helping ambitious brands turn clear strategy into memorable digital experiences.',
          },
        },
      });

      await tx.page.updateMany({ where: { siteId: site.id, isHomepage: true }, data: { isHomepage: false } });
      const pages = [
        {
          slug: 'home', title: 'Home', isHomepage: true,
          contentJson: doc('Ideas become stronger when the website does the explaining.', [
            { body: 'Northstar helps ambitious teams clarify their message, shape their digital presence, and launch experiences people remember.' },
            { heading: 'Strategy first', body: 'We start with the problem, audience, and business outcome before choosing the visual direction.' },
            { heading: 'Built to convert', body: 'Every page is designed to help visitors understand what matters and take the next useful step.' },
            { heading: 'Ready to build something clearer?', body: 'Tell us what you are working on and we will help shape the next version.' },
          ]),
        },
        {
          slug: 'about', title: 'About', isHomepage: false,
          contentJson: doc('Small team. Serious clarity.', [
            { body: 'We are a strategy and design studio for teams that want their website to feel as strong as the work behind it.' },
            { heading: 'How we work', body: 'Clear thinking, useful collaboration, fast iteration, and decisions tied to real business goals.' },
          ]),
        },
        {
          slug: 'services', title: 'Services', isHomepage: false,
          contentJson: doc('Services built around momentum', [
            { heading: 'Brand positioning', body: 'Clarify the message, audience, offer, and market story before designing the experience.' },
            { heading: 'Website design', body: 'Create a polished site structure and visual system that makes the value easy to understand.' },
            { heading: 'Content systems', body: 'Build reusable content patterns your team can update without slowing down.' },
          ]),
        },
      ];

      for (const page of pages) {
        await tx.page.upsert({
          where: { siteId_slug: { siteId: site.id, slug: page.slug } },
          update: { ...page, status: 'PUBLISHED', publishedAt: new Date() },
          create: { siteId: site.id, ...page, status: 'PUBLISHED', publishedAt: new Date() },
        });
      }

      const posts = [
        ['How to know when your website message is too complicated', 'website-message', 'A practical way to spot confusing website copy before visitors do.'],
        ['The simplest content system for a small team', 'simple-content-system', 'A lightweight publishing rhythm that keeps your site useful without creating more work.'],
        ['Why good design starts before Figma', 'design-before-figma', 'The strategic decisions that make the visual work faster and stronger later.'],
      ] as const;

      for (const [title, slug, excerpt] of posts) {
        await tx.post.upsert({
          where: { siteId_slug: { siteId: site.id, slug } },
          update: { title, excerpt, contentJson: doc(title, [{ body: excerpt }, { heading: 'Start with the real question', body: 'Strong content becomes easier when the page has one clear job and one clear audience.' }]), status: 'PUBLISHED', publishedAt: new Date() },
          create: { siteId: site.id, title, slug, excerpt, contentJson: doc(title, [{ body: excerpt }, { heading: 'Start with the real question', body: 'Strong content becomes easier when the page has one clear job and one clear audience.' }]), status: 'PUBLISHED', publishedAt: new Date() },
        });
      }
    });

    return Response.json({ ok: true });
  } catch {
    return jsonError('Unable to seed demo content', 400);
  }
}
