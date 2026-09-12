import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

type IntegrationConfig = Record<string, { enabled: boolean; value?: string }>;

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    return Response.json({ integrations: (config.integrations as IntegrationConfig | undefined) ?? {} });
  } catch {
    return jsonError('Unable to load integrations', 404);
  }
}

export async function PATCH(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = (await request.json()) as { provider?: string; enabled?: boolean; value?: string };
    const provider = body.provider;
    const allowed = ['google-analytics', 'whatsapp', 'calendly', 'mailchimp', 'paystack'];
    if (!provider || !allowed.includes(provider)) return jsonError('Unsupported integration');

    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const integrations = ((config.integrations as IntegrationConfig | undefined) ?? {});
    const next = {
      ...integrations,
      [provider]: {
        enabled: body.enabled !== false,
        ...(body.value?.trim() ? { value: body.value.trim().slice(0, 500) } : {}),
      },
    };

    await prisma.site.update({
      where: { id: site.id },
      data: { themeConfig: { ...config, integrations: next } },
    });
    return Response.json({ integrations: next });
  } catch {
    return jsonError('Unable to update integration', 400);
  }
}
