import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

type IntegrationConfig = Record<string, { enabled: boolean; value?: string }>;

function isValid(provider: string, value: string) {
  if (provider === 'google-analytics') return /^G-[A-Z0-9]+$/i.test(value);
  if (provider === 'whatsapp') return value.replace(/\D/g, '').length >= 10;
  return /^https:\/\//i.test(value);
}

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

    const enabled = body.enabled !== false;
    const value = body.value?.trim() || '';
    if (enabled && !isValid(provider, value)) {
      return jsonError(
        provider === 'google-analytics'
          ? 'Enter a valid Google Analytics measurement ID.'
          : provider === 'whatsapp'
            ? 'Enter a valid WhatsApp phone number.'
            : 'Enter a full https:// URL.',
      );
    }

    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const integrations = ((config.integrations as IntegrationConfig | undefined) ?? {});
    const previous = integrations[provider] || {};
    const next = {
      ...integrations,
      [provider]: {
        ...previous,
        enabled,
        ...(value ? { value: value.slice(0, 500) } : {}),
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
