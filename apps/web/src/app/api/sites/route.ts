import { createSiteSchema } from '@buildora/contracts';
import { prisma } from '@buildora/database';
import { getHackathonUser, jsonError } from '../../../server/hackathon';

export async function GET() {
  const user = await getHackathonUser();
  const sites = await prisma.site.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(sites);
}

export async function POST(request: Request) {
  try {
    const user = await getHackathonUser();
    const parsed = createSiteSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid site data');

    const site = await prisma.$transaction(async (tx) => {
      const created = await tx.site.create({
        data: {
          ...parsed.data,
          ownerId: user.id,
          themeConfig: parsed.data.themeConfig ?? {},
        },
      });
      await tx.page.create({
        data: {
          siteId: created.id,
          title: 'Home',
          slug: 'home',
          isHomepage: true,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          contentJson: {
            type: 'doc',
            content: [
              { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: `Welcome to ${created.name}` }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Start with the AI site builder, visual sections, or edit this page directly.' }] },
            ],
          },
        },
      });
      return created;
    });
    return Response.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return jsonError('That site slug is already in use.', 409);
    }
    return jsonError('Unable to create site', 500);
  }
}
