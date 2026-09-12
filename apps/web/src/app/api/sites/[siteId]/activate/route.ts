import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { site } = await assertOwnedSite(params.siteId);
    const updated = await prisma.site.update({
      where: { id: site.id },
      data: { updatedAt: new Date() },
    });
    return Response.json(updated);
  } catch {
    return jsonError('Unable to activate site', 400);
  }
}
