import { randomUUID } from 'crypto';
import { prisma } from '@buildora/database';
import { assertOwnedSite, ensureHackathonSchema, jsonError } from '../../../../../../../server/hackathon';

export async function GET(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureHackathonSchema();
    const page = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.siteId } });
    if (!page) return jsonError('Page not found', 404);

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; slug: string; createdAt: string }>>(
      `SELECT id, title, slug, createdAt FROM page_versions WHERE pageId = ? AND siteId = ? ORDER BY createdAt DESC LIMIT 20`,
      params.pageId,
      params.siteId,
    );
    return Response.json(rows);
  } catch {
    return jsonError('Unable to load page versions', 400);
  }
}

export async function POST(_: Request, { params }: { params: { siteId: string; pageId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureHackathonSchema();
    const page = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.siteId } });
    if (!page) return jsonError('Page not found', 404);

    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO page_versions (id, pageId, siteId, title, slug, contentJson, seoTitle, seoDescription) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      page.id,
      page.siteId,
      page.title,
      page.slug,
      JSON.stringify(page.contentJson),
      page.seoTitle,
      page.seoDescription,
    );

    return Response.json({ id }, { status: 201 });
  } catch {
    return jsonError('Unable to save page version', 400);
  }
}
