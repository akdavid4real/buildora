import { prisma } from '@buildora/database';

export const HACKATHON_USER_EMAIL = 'demo@buildora.local';

let schemaReady: Promise<void> | null = null;

async function initializeSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      userId TEXT NOT NULL,
      familyId TEXT NOT NULL,
      isRevoked INTEGER NOT NULL DEFAULT 0,
      revokedAt DATETIME,
      expiresAt DATETIME NOT NULL,
      userAgent TEXT,
      ipAddress TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      ownerId TEXT NOT NULL,
      themeId TEXT NOT NULL DEFAULT 'minimal-blog',
      themeConfig TEXT NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      contentJson TEXT NOT NULL DEFAULT '{"type":"doc","content":[]}',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      isHomepage INTEGER NOT NULL DEFAULT 0,
      seoTitle TEXT,
      seoDescription TEXT,
      publishedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(siteId, slug)
    )`,
    `CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      uploaderId TEXT NOT NULL,
      filename TEXT NOT NULL,
      originalFilename TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      s3Key TEXT NOT NULL UNIQUE,
      publicUrl TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      altText TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      excerpt TEXT,
      coverImageId TEXT,
      contentJson TEXT NOT NULL DEFAULT '{"type":"doc","content":[]}',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      seoTitle TEXT,
      seoDescription TEXT,
      publishedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(siteId, slug)
    )`,
    `CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      userId TEXT NOT NULL,
      actionType TEXT NOT NULL,
      model TEXT NOT NULL,
      promptTokens INTEGER NOT NULL DEFAULT 0,
      completionTokens INTEGER NOT NULL DEFAULT 0,
      totalTokens INTEGER NOT NULL DEFAULT 0,
      durationMs INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      errorMessage TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS page_versions (
      id TEXT PRIMARY KEY NOT NULL,
      pageId TEXT NOT NULL,
      siteId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      contentJson TEXT NOT NULL,
      seoTitle TEXT,
      seoDescription TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS sites_ownerId_idx ON sites(ownerId)`,
    `CREATE INDEX IF NOT EXISTS pages_siteId_status_idx ON pages(siteId, status)`,
    `CREATE INDEX IF NOT EXISTS pages_siteId_isHomepage_idx ON pages(siteId, isHomepage)`,
    `CREATE INDEX IF NOT EXISTS posts_siteId_status_publishedAt_idx ON posts(siteId, status, publishedAt)`,
    `CREATE INDEX IF NOT EXISTS media_assets_siteId_idx ON media_assets(siteId)`,
    `CREATE INDEX IF NOT EXISTS page_versions_pageId_createdAt_idx ON page_versions(pageId, createdAt DESC)`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function ensureHackathonSchema() {
  schemaReady ??= initializeSchema().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function getHackathonUser() {
  await ensureHackathonSchema();

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

export function toPublicUser(user: Awaited<ReturnType<typeof getHackathonUser>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
