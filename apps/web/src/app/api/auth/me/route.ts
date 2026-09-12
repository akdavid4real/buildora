import { getHackathonUser } from '../../../../server/hackathon';

export async function GET() {
  const user = await getHackathonUser();
  return Response.json(user);
}
