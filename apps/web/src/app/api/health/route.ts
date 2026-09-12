import { prisma } from '@buildora/database';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: 'buildora-web', database: 'connected' });
  } catch {
    return NextResponse.json(
      { ok: false, app: 'buildora-web', database: 'unavailable' },
      { status: 503 },
    );
  }
}
