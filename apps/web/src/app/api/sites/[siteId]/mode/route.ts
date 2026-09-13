import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';
import { classifySiteMode, SITE_MODES, type SiteMode } from '../../../../../server/site-modes';

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const config = site.themeConfig && typeof site.themeConfig === 'object' ? site.themeConfig as Record<string, unknown> : {};
    return Response.json({ mode: (config.siteMode as SiteMode) || 'business', detectedFrom: config.generatedFrom || null });
  } catch { return jsonError('Unable to load website mode', 400); }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = await request.json() as { mode?: string; description?: string };
    const mode = body.mode && (SITE_MODES as readonly string[]).includes(body.mode)
      ? body.mode as SiteMode
      : classifySiteMode(String(body.description || ''));
    const config = site.themeConfig && typeof site.themeConfig === 'object' ? site.themeConfig as Record<string, unknown> : {};
    await prisma.site.update({ where: { id: site.id }, data: { themeConfig: { ...config, siteMode: mode } } });
    return Response.json({ mode });
  } catch { return jsonError('Unable to update website mode', 400); }
}
