import { prisma } from '@buildora/database';
import { ensureHackathonSchema, jsonError } from '../../../../../../server/hackathon';
import { createModeSubmission, SITE_MODES, type SiteMode } from '../../../../../../server/site-modes';

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureHackathonSchema();
    const site = await prisma.site.findUnique({ where: { slug: params.slug } });
    if (!site) return jsonError('Site not found', 404);
    const config = site.themeConfig && typeof site.themeConfig === 'object' ? site.themeConfig as Record<string, unknown> : {};
    const configured = String(config.siteMode || 'business');
    const mode = (SITE_MODES as readonly string[]).includes(configured) ? configured as SiteMode : 'business';
    const body = await request.json() as Record<string, unknown>;
    const kind = String(body.kind || 'inquiry').slice(0, 80);
    const recordId = body.recordId ? String(body.recordId) : null;
    const payload = body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : body;
    const id = await createModeSubmission({ siteId: site.id, mode, kind, recordId, payload });
    return Response.json({ ok: true, id, message: 'Thanks — your request was received.' }, { status: 201 });
  } catch { return jsonError('Unable to submit request', 400); }
}
