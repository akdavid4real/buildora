import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';
import { listModeRecords, SITE_MODES, upsertModeRecord, type SiteMode } from '../../../../../server/site-modes';

export async function GET(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const config = site.themeConfig && typeof site.themeConfig === 'object' ? site.themeConfig as Record<string, unknown> : {};
    const mode = ((config.siteMode as SiteMode) || 'business');
    const kind = new URL(request.url).searchParams.get('kind') || undefined;
    return Response.json({ mode, data: await listModeRecords(site.id, mode, kind) });
  } catch { return jsonError('Unable to load mode records', 400); }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = await request.json() as Record<string, unknown>;
    const config = site.themeConfig && typeof site.themeConfig === 'object' ? site.themeConfig as Record<string, unknown> : {};
    const configured = String(config.siteMode || 'business');
    const mode = (SITE_MODES as readonly string[]).includes(configured) ? configured as SiteMode : 'business';
    const kind = String(body.kind || 'item').trim(); const title = String(body.title || '').trim();
    const slug = String(body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
    if (!title || !slug) return jsonError('Title is required');
    await upsertModeRecord({ siteId: site.id, mode, kind, title, slug, data: body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : {}, status: body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED' });
    return Response.json({ ok: true }, { status: 201 });
  } catch { return jsonError('Unable to save mode record', 400); }
}
