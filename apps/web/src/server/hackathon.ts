import { prisma } from '@buildora/database';

export const HACKATHON_USER_EMAIL = 'demo@buildora.local';

export async function getHackathonUser() {
  return prisma.user.upsert({
    where: { email: HACKATHON_USER_EMAIL },
    update: {},
    create: {
      email: HACKATHON_USER_EMAIL,
      name: 'Alex Rivera',
      passwordHash: 'hackathon-demo-no-password-login',
    },
  });
}

export async function assertOwnedSite(siteId: string) {
  const user = await getHackathonUser();
  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: user.id },
  });
  if (!site) throw new Error('SITE_NOT_FOUND');
  return { user, site };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ message }, { status });
}
