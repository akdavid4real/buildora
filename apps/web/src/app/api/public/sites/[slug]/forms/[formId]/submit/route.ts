import { prisma } from '@buildora/database';
import { ensureHackathonSchema, jsonError } from '../../../../../../../../server/hackathon';

type SiteForm = {
  id: string;
  type: 'contact' | 'newsletter' | 'booking';
  title: string;
  pageSlug: string;
  enabled: boolean;
};

export async function POST(request: Request, { params }: { params: { slug: string; formId: string } }) {
  try {
    await ensureHackathonSchema();
    const site = await prisma.site.findUnique({ where: { slug: params.slug } });
    if (!site) return jsonError('Site not found', 404);

    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const forms = Array.isArray(config.forms) ? (config.forms as SiteForm[]) : [];
    const form = forms.find((item) => item.id === params.formId && item.enabled);
    if (!form) return jsonError('Form is unavailable', 404);

    const raw = (await request.json()) as Record<string, unknown>;
    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.trim()) payload[key.slice(0, 50)] = value.trim().slice(0, 2000);
    }
    if (Object.keys(payload).length === 0) return jsonError('Please complete the form.');

    await prisma.$executeRawUnsafe(
      'INSERT INTO form_submissions (id, siteId, formId, formType, payload, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      crypto.randomUUID(),
      site.id,
      form.id,
      form.type,
      JSON.stringify(payload),
    );

    return Response.json({ ok: true, message: 'Thanks — your response was received.' }, { status: 201 });
  } catch (error) {
    console.error('Form submission failed', error);
    return jsonError('Unable to submit form', 500);
  }
}
