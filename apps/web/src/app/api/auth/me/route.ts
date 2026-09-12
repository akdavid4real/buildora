import { getHackathonUser, toPublicUser } from '../../../../server/hackathon';

export async function GET() {
  const user = await getHackathonUser();
  return Response.json(toPublicUser(user));
}
