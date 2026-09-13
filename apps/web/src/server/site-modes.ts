import { prisma } from '@buildora/database';

export const SITE_MODES = ['business','portfolio','blog','saas','ecommerce','booking','restaurant','event','courses','real-estate','recruitment','nonprofit'] as const;
export type SiteMode = (typeof SITE_MODES)[number];

export type ModeRecord = {
  id: string;
  siteId: string;
  mode: SiteMode;
  kind: string;
  title: string;
  slug: string;
  data: Record<string, unknown>;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
};

let modeSchemaReady: Promise<void> | null = null;

async function initializeModeSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS site_mode_records (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      mode TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(siteId, kind, slug)
    )`,
    `CREATE TABLE IF NOT EXISTS site_mode_submissions (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      mode TEXT NOT NULL,
      kind TEXT NOT NULL,
      recordId TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'NEW',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS site_mode_records_site_mode_idx ON site_mode_records(siteId, mode, kind)`,
    `CREATE INDEX IF NOT EXISTS site_mode_submissions_site_mode_idx ON site_mode_submissions(siteId, mode, kind, createdAt)`,
  ];
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
}

export async function ensureSiteModeSchema() {
  modeSchemaReady ??= initializeModeSchema().catch((error) => { modeSchemaReady = null; throw error; });
  return modeSchemaReady;
}

export function classifySiteMode(description: string): SiteMode {
  const text = description.toLowerCase();
  if (/\b(ecommerce|e-commerce|online store|shop|sell products|retail|skincare|fashion|clothing|jewelry|cosmetics)\b/.test(text)) return 'ecommerce';
  if (/\b(restaurant|cafe|café|food menu|diner|bistro|eatery)\b/.test(text)) return 'restaurant';
  if (/\b(conference|event|summit|festival|workshop|meetup|concert)\b/.test(text)) return 'event';
  if (/\b(real estate|property|properties|realtor|estate agent|apartments|houses for sale)\b/.test(text)) return 'real-estate';
  if (/\b(recruitment|jobs|job board|careers|hiring|vacancies|talent agency)\b/.test(text)) return 'recruitment';
  if (/\b(course|courses|training academy|school|bootcamp|classes|learning platform)\b/.test(text)) return 'courses';
  if (/\b(ngo|nonprofit|non-profit|charity|foundation|donation|volunteer)\b/.test(text)) return 'nonprofit';
  if (/\b(appointment|booking|book appointments|salon|barber|spa|clinic|coach|consultant|photographer|therapy)\b/.test(text)) return 'booking';
  if (/\b(saas|software as a service|startup app|software platform)\b/.test(text)) return 'saas';
  if (/\b(portfolio|freelancer|designer|photographer portfolio|personal brand|creator)\b/.test(text)) return 'portfolio';
  if (/\b(blog|publication|magazine|news site|newsletter)\b/.test(text)) return 'blog';
  return 'business';
}

export async function listModeRecords(siteId: string, mode: SiteMode, kind?: string) {
  await ensureSiteModeSchema();
  const rows = kind
    ? await prisma.$queryRawUnsafe<Array<Omit<ModeRecord, 'data'> & { data: string }>>('SELECT * FROM site_mode_records WHERE siteId = ? AND mode = ? AND kind = ? AND status = ? ORDER BY createdAt DESC', siteId, mode, kind, 'PUBLISHED')
    : await prisma.$queryRawUnsafe<Array<Omit<ModeRecord, 'data'> & { data: string }>>('SELECT * FROM site_mode_records WHERE siteId = ? AND mode = ? AND status = ? ORDER BY createdAt DESC', siteId, mode, 'PUBLISHED');
  return rows.map((row) => ({ ...row, data: (() => { try { return JSON.parse(row.data); } catch { return {}; } })() }));
}

export async function upsertModeRecord(input: { siteId: string; mode: SiteMode; kind: string; title: string; slug: string; data: Record<string, unknown>; status?: 'DRAFT' | 'PUBLISHED' }) {
  await ensureSiteModeSchema();
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO site_mode_records (id, siteId, mode, kind, title, slug, data, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(siteId, kind, slug) DO UPDATE SET mode = excluded.mode, title = excluded.title, data = excluded.data, status = excluded.status, updatedAt = CURRENT_TIMESTAMP`,
    id, input.siteId, input.mode, input.kind, input.title.slice(0, 160), input.slug.slice(0, 100), JSON.stringify(input.data), input.status || 'PUBLISHED',
  );
}

export async function createModeSubmission(input: { siteId: string; mode: SiteMode; kind: string; recordId?: string | null; payload: Record<string, unknown> }) {
  await ensureSiteModeSchema();
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe('INSERT INTO site_mode_submissions (id, siteId, mode, kind, recordId, payload) VALUES (?, ?, ?, ?, ?, ?)', id, input.siteId, input.mode, input.kind, input.recordId || null, JSON.stringify(input.payload));
  return id;
}
