import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

type SavedTemplate = {
  id: string;
  name: string;
  nodes: Array<Record<string, unknown>>;
};

function readTemplates(themeConfig: unknown): SavedTemplate[] {
  const config = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
  return Array.isArray(config.reusableSections) ? (config.reusableSections as SavedTemplate[]) : [];
}

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    return Response.json({ data: readTemplates(site.themeConfig) });
  } catch {
    return jsonError('Unable to load reusable sections', 400);
  }
}

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const body = (await request.json()) as { name?: string; nodes?: Array<Record<string, unknown>> };
    const name = body.name?.trim();
    if (!name || !Array.isArray(body.nodes) || body.nodes.length === 0) {
      return jsonError('Name and section content are required.');
    }
    const current = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const templates = readTemplates(site.themeConfig);
    const template: SavedTemplate = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      nodes: body.nodes.slice(0, 100),
    };
    const next = [template, ...templates].slice(0, 30);
    await prisma.site.update({
      where: { id: site.id },
      data: { themeConfig: { ...current, reusableSections: next } },
    });
    return Response.json(template, { status: 201 });
  } catch {
    return jsonError('Unable to save reusable section', 400);
  }
}

export async function DELETE(request: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError('Template id is required.');
    const current = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    const next = readTemplates(site.themeConfig).filter((item) => item.id !== id);
    await prisma.site.update({
      where: { id: site.id },
      data: { themeConfig: { ...current, reusableSections: next } },
    });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError('Unable to delete reusable section', 400);
  }
}
