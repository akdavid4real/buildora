import { prisma } from '@buildora/database';
import { NextResponse } from 'next/server';
import { ensureHackathonSchema } from '../../../server/hackathon';

export async function GET() {
  try {
    await ensureHackathonSchema();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: 'buildora-web', database: 'connected', schema: 'ready' });
  } catch (error) {
    console.error('Buildora health check failed', error);
    return NextResponse.json(
      { ok: false, app: 'buildora-web', database: 'unavailable' },
      { status: 503 },
    );
  }
}
