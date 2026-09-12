import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

type FormType = 'contact' | 'newsletter' | 'booking';

type SiteForm = {
  id: string;
  type: FormType;
  title: string;
  pageSlug: string;
  enabled: boolean;
};

function readForms(themeConfig: unknown): SiteForm[] {
  const config = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
  return Array.isArray(config.forms) ? (config.forms as SiteForm[]) : [];
}

function formIntro(form: SiteForm) {
  const body = form.type === 'newsletter'
    ? 'Subscribe for useful updates, ideas, and announcements.'
    : form.type === 'booking'
      ? 'Tell us what you need and the best time to reach you.'
      : 'Send us a message and we will get back to you.';
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: form.title }] },
      { type: 'paragraph', content: [{ type: 'text', text: body }] },
    ],
  };
}

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    return Response.json({ forms: readForms(site.themeConfig) });
  } catch {
    return jsonError('Unable to load forms', 404);
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = (await request.json()) as Partial<SiteForm>;
    const type = body.type;
    if (!type || !['contact', 'newsletter', 'booking'].includes(type)) {
      return jsonError('Choose contact, newsletter, or booking form.');
    }

    const current = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const forms = readForms(site.themeConfig);
    if (forms.some((item) => item.type === type)) {
      return jsonError(`A ${type} form already exists for this site.`, 409);
    }

    const form: SiteForm = {
      id: crypto.randomUUID(),
      type,
      title: String(body.title || (type === 'newsletter' ? 'Join our newsletter' : type === 'booking' ? 'Book an enquiry' : 'Contact us')).slice(0, 100),
      pageSlug: String(body.pageSlug || (type === 'newsletter' ? 'newsletter' : type === 'booking' ? 'booking' : 'contact')).replace(/^\/+|\/+$/g, '').slice(0, 80) || 'contact',
      enabled: body.enabled !== false,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const nextSite = await tx.site.update({
        where: { id: site.id },
        data: { themeConfig: { ...current, forms: [...forms, form] } },
      });
      await tx.page.upsert({
        where: { siteId_slug: { siteId: site.id, slug: form.pageSlug } },
        update: {
          title: form.title,
          contentJson: formIntro(form),
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        create: {
          siteId: site.id,
          title: form.title,
          slug: form.pageSlug,
          contentJson: formIntro(form),
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      return nextSite;
    });

    return Response.json({ form, themeConfig: updated.themeConfig }, { status: 201 });
  } catch {
    return jsonError('Unable to create form', 400);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = (await request.json()) as Partial<SiteForm> & { id?: string };
    if (!body.id) return jsonError('Form id is required.');
    const current = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const forms = readForms(site.themeConfig);
    const currentForm = forms.find((form) => form.id === body.id);
    if (!currentForm) return jsonError('Form not found', 404);
    const next = forms.map((form) =>
      form.id === body.id
        ? {
            ...form,
            ...(body.title !== undefined ? { title: String(body.title).slice(0, 100) } : {}),
            ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
          }
        : form,
    );
    const updatedForm = next.find((form) => form.id === body.id)!;
    await prisma.$transaction(async (tx) => {
      await tx.site.update({ where: { id: site.id }, data: { themeConfig: { ...current, forms: next } } });
      await tx.page.updateMany({
        where: { siteId: site.id, slug: updatedForm.pageSlug },
        data: {
          title: updatedForm.title,
          status: updatedForm.enabled ? 'PUBLISHED' : 'DRAFT',
          publishedAt: updatedForm.enabled ? new Date() : null,
        },
      });
    });
    return Response.json({ forms: next });
  } catch {
    return jsonError('Unable to update form', 400);
  }
}

export async function DELETE(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError('Form id is required.');
    const current = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const allForms = readForms(site.themeConfig);
    const removed = allForms.find((form) => form.id === id);
    if (!removed) return jsonError('Form not found', 404);
    const forms = allForms.filter((form) => form.id !== id);
    await prisma.$transaction(async (tx) => {
      await tx.site.update({ where: { id: site.id }, data: { themeConfig: { ...current, forms } } });
      await tx.page.updateMany({
        where: { siteId: site.id, slug: removed.pageSlug },
        data: { status: 'DRAFT', publishedAt: null },
      });
    });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete form', 400);
  }
}
