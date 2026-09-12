import { prisma } from '@buildora/database';
import { assertOwnedSite, ensureHackathonSchema, jsonError } from '../../../../../server/hackathon';

type SubmissionRow = {
  id: string;
  siteId: string;
  formId: string;
  formType: string;
  payload: string;
  createdAt: string;
};

export async function GET(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    await ensureHackathonSchema();
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const rows = await prisma.$queryRawUnsafe<SubmissionRow[]>(
      'SELECT id, siteId, formId, formType, payload, createdAt FROM form_submissions WHERE siteId = ? ORDER BY createdAt DESC LIMIT ?',
      params.siteId,
      limit,
    );
    return Response.json({
      data: rows.map((row) => ({
        ...row,
        payload: (() => {
          try { return JSON.parse(row.payload); } catch { return {}; }
        })(),
      })),
    });
  } catch {
    return jsonError('Unable to load submissions', 400);
  }
}
