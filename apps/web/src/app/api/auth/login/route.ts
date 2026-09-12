import { getHackathonUser, toPublicUser } from '../../../../server/hackathon';

export async function POST() {
  const user = await getHackathonUser();
  return Response.json({
    user: toPublicUser(user),
    accessToken: 'buildora-hackathon-session',
  });
}
