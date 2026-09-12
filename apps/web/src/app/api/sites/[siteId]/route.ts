import { updateSiteSchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../server/hackathon';

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    return Response.json(site);
  } catch {
    return jsonError('Site not found', 404);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const parsed = updateSiteSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid site data');

    const currentConfig = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const incomingConfig = parsed.data.themeConfig && typeof parsed.data.themeConfig === 'object'
      ? (parsed.data.themeConfig as Record<string, unknown>)
      : undefined;

    const updated = await prisma.site.update({
      where: { id: site.id },
      data: {
        ...parsed.data,
        ...(incomingConfig ? { themeConfig: { ...currentConfig, ...incomingConfig } } : {}),
      },
    });
    return Response.json(updated);
  } catch {
    return jsonError('Unable to update site', 400);
  }
}
