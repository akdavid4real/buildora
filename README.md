# Buildora

Buildora is a lightweight AI-powered CMS designed for simple brochure websites and blogs.

## Core Architectural Decisions

- **Runtime & Package Management:** [Bun](https://bun.sh) (`v1.4.2+`) is the single runtime and package manager across all apps and packages in this monorepo.
- **Monorepo Orchestration:** [Turborepo](https://turbo.build) coordinates builds, linting, typechecking, tests, and database generation.
- **Backend Architecture (`apps/api`):** [NestJS](https://nestjs.com) REST API with modular architecture (`AuthModule`, `SitesModule`, `PagesModule`, `PostsModule`, `PrismaModule`).
  - Strict startup configuration validation with Zod.
  - Global API prefix `/api/v1`, Helmet security headers, credentialed CORS scoped to `WEB_URL`.
  - Global exception filter converting Prisma unique conflicts (`P2002`) to `409 Conflict` without leaking internals.
- **Authentication & Security:**
  - **Passwords:** Hashed with `Argon2id` (memoryCost: 64MB, timeCost: 3, parallelism: 4).
  - **Access Tokens:** Short-lived JWT bearer tokens (15 minutes).
  - **Refresh Tokens:** Opaque cryptographically random 256-bit tokens held exclusively in `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Secure` (in production) cookies. Only SHA-256 hashes are persisted in the database.
  - **Transactional Rotation & Reuse Detection:** Each refresh operation invalidates the consumed token and issues a replacement within the same token family. Presenting an already-revoked token triggers immediate revocation of the entire family as a suspected compromise.
- **Sites & Multi-Tenancy:**
  - Every site lookup, update, and resource access is strictly query-scoped by `ownerId` directly in the database query (`WHERE id = :id AND ownerId = :ownerId`), preventing horizontal privilege escalation.
  - Sites validate `themeId` against the contracts fixed theme registry (`minimal-blog`, `small-business`, `personal-portfolio`).
- **Content Management (Pages & Posts):**
  - **Ownership Boundary:** All page and post reads, writes, updates, publishing, and deletions are scoped through site ownership (`site.ownerId === userId`) at the database level.
  - **Homepage Invariant:** Enforces at most one homepage per site both in service-layer transactions (unsetting previous homepage atomically) and at the database boundary via a PostgreSQL partial unique index (`CREATE UNIQUE INDEX ... WHERE isHomepage = true`).
  - **Cover Image Scoping:** Post `coverImageId` references are verified against `MediaAsset` records belonging to the same owned site before linking.
  - **Publish State Consistency:** Publishing explicitly sets `status = 'PUBLISHED'` and assigns `publishedAt = new Date()`; unpublishing sets `status = 'DRAFT'` and `publishedAt = null`.
  - **Canonical Rich-Text Format:** Tiptap JSON with root `{ type: 'doc', content: [...] }` structure is the single source of truth in storage; raw HTML is never stored.
  - **Deterministic Pagination:** Ordered by `createdAt: 'desc'` and `id: 'desc'` with standard pagination metadata.
- **Media Safety:** Raster images only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) to avoid SVG active-content/XSS risks.
- **Data Layer (`packages/database`):** PostgreSQL managed with [Prisma ORM](https://www.prisma.io).
- **Shared Contracts (`packages/contracts`):** [Zod](https://zod.dev) validation schemas and inferred TypeScript types.

---

## Repository Structure

```
buildora/
├── apps/
│   └── api/                  # NestJS REST API (Auth, Sites, Pages, Posts, Prisma, Security)
├── packages/
│   ├── database/             # Prisma schema, client singleton, migrations, and database scripts
│   ├── contracts/            # Zod validation schemas and shared TypeScript types
│   ├── typescript-config/    # Shared TypeScript configurations (base, node, react)
│   └── eslint-config/        # Shared ESLint configuration
├── docker-compose.yml        # Local PostgreSQL container with healthcheck
├── turbo.json                # Turborepo task pipeline
├── package.json              # Bun workspace definition and root scripts
└── .env.example              # Environment variable template
```

---

## REST API Overview

### Authentication (`/api/v1/auth`)

- `POST /register` - Register a new account & receive access token + refresh cookie
- `POST /login` - Log in with email and password
- `POST /refresh` - Rotate refresh token & receive new access token
- `POST /logout` - Revoke current refresh token family & clear cookie
- `GET /me` - Get current authenticated user profile

### Sites (`/api/v1/sites`)

- `POST /` - Create a new site owned by the user
- `GET /` - List all sites owned by the user
- `GET /:siteId` - Get a specific owned site
- `PATCH /:siteId` - Update an owned site

### Pages (`/api/v1/sites/:siteId/pages`)

- `POST /` - Create a page for a site (supports transactional homepage designation)
- `GET /` - List pages for a site (supports pagination, status filter, search)
- `GET /:pageId` - Get a specific page
- `PATCH /:pageId` - Update a page
- `DELETE /:pageId` - Delete a page
- `POST /:pageId/publish` - Publish a page (`status = PUBLISHED`, `publishedAt = now`)
- `POST /:pageId/unpublish` - Unpublish a page (`status = DRAFT`, `publishedAt = null`)

### Posts (`/api/v1/sites/:siteId/posts`)

- `POST /` - Create a blog post (validates site-scoped cover image)
- `GET /` - List blog posts for a site (supports pagination, status filter, search)
- `GET /:postId` - Get a specific blog post
- `PATCH /:postId` - Update a blog post
- `DELETE /:postId` - Delete a blog post
- `POST /:postId/publish` - Publish a blog post (`status = PUBLISHED`, `publishedAt = now`)
- `POST /:postId/unpublish` - Unpublish a blog post (`status = DRAFT`, `publishedAt = null`)

### Media (`/api/v1/sites/:siteId/media`)

- `POST /upload-request` - Generate presigned PUT URL and site-scoped unpredictable storage key (validates raster MIME + 10MB limits)
- `POST /confirm` - Prove object existence via `HeadObject` metadata verification and persist `MediaAsset`
- `GET /` - List media assets for a site (supports pagination, search)
- `GET /:mediaId` - Get a specific media asset
- `PATCH /:mediaId` - Update media alt text
- `DELETE /:mediaId` - Delete media asset from S3 and database (refuses deletion with 409 Conflict if used as post cover)

### AI Assistant (`/api/v1/sites/:siteId/ai`)

- `POST /generate` - Generate AI suggestions via server-side Mistral AI (20 daily success limit per user, 20s timeout, suggestion only)
- `GET /logs` - List audit history of AI generations for a site (supports pagination, actionType filter)

---

## Quick Start & Setup

### 1. Prerequisites

- [Bun](https://bun.sh) (`v1.4.2` or later)
- [Docker](https://www.docker.com) & Docker Compose (for local PostgreSQL)

### 2. Install Dependencies

```bash
bun install
```

### 3. Start Local PostgreSQL Database

```bash
bun run docker:up
```

### 4. Configure Environment

```bash
cp .env.example .env
```

### 5. Generate Prisma Client & Push Database Schema

```bash
bun run db:generate
bun run db:push
```

### 6. Run API in Development Mode

```bash
bun --filter @buildora/api dev
```

### 7. Run Web Frontend in Development Mode

```bash
# Uses NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1" by default
bun --filter @buildora/web dev
```

---

## Available Root Commands

| Command                | Description                                                 |
| :--------------------- | :---------------------------------------------------------- |
| `bun run build`        | Builds all packages and applications via Turbo              |
| `bun run typecheck`    | Typechecks all packages and applications                    |
| `bun run lint`         | Runs ESLint across all packages and apps                    |
| `bun run test`         | Runs unit test suites across all packages and apps          |
| `bun run format`       | Formats all files with Prettier                             |
| `bun run format:check` | Verifies code formatting with Prettier                      |
| `bun run db:generate`  | Generates the Prisma Client                                 |
| `bun run db:push`      | Pushes the Prisma schema to the database without migrations |
| `bun run db:migrate`   | Runs database migrations (for development/production)       |
| `bun run db:studio`    | Opens Prisma Studio web interface                           |
| `bun run docker:up`    | Starts local PostgreSQL container in background             |
| `bun run docker:down`  | Stops local PostgreSQL container                            |
| `bun run docker:logs`  | Streams PostgreSQL container logs                           |
