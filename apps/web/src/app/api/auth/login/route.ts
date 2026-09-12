import { getHackathonUser } from '../../../../server/hackathon';

export async function POST() {
  const user = await getHackathonUser();
  return Response.json({
    user,
    accessToken: 'buildora-hackathon-session',
  });
}
