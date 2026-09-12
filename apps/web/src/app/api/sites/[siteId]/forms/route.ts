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
    const form: SiteForm = {
      id: crypto.randomUUID(),
      type,
      title: String(body.title || (type === 'newsletter' ? 'Join our newsletter' : type === 'booking' ? 'Book an enquiry' : 'Contact us')).slice(0, 100),
      pageSlug: String(body.pageSlug || 'contact').replace(/^\/+|\/+$/g, '').slice(0, 80) || 'contact',
      enabled: body.enabled !== false,
    };

    const updated = await prisma.site.update({
      where: { id: site.id },
      data: { themeConfig: { ...current, forms: [...forms, form] } },
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
    const next = forms.map((form) =>
      form.id === body.id
        ? {
            ...form,
            ...(body.title !== undefined ? { title: String(body.title).slice(0, 100) } : {}),
            ...(body.pageSlug !== undefined ? { pageSlug: String(body.pageSlug).replace(/^\/+|\/+$/g, '').slice(0, 80) } : {}),
            ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
          }
        : form,
    );
    await prisma.site.update({ where: { id: site.id }, data: { themeConfig: { ...current, forms: next } } });
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
    const forms = readForms(site.themeConfig).filter((form) => form.id !== id);
    await prisma.site.update({ where: { id: site.id }, data: { themeConfig: { ...current, forms } } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete form', 400);
  }
}
