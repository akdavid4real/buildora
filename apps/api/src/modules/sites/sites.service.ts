import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@buildora/database';
import type {
  CreateSiteDto,
  JsonObject,
  PublicSiteResponse,
  SiteResponse,
  ThemeId,
  UpdateSiteDto,
} from '@buildora/contracts';
import { THEME_IDS } from '@buildora/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SitesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Creates a new site owned by the authenticated user.
   * Catches Prisma unique violations (P2002) directly to close TOCTOU race windows.
   */
  async createSite(userId: string, dto: CreateSiteDto): Promise<SiteResponse> {
    if (dto.themeId && !THEME_IDS.includes(dto.themeId as ThemeId)) {
      throw new BadRequestException(`Invalid themeId. Must be one of: ${THEME_IDS.join(', ')}`);
    }

    const normalizedSlug = dto.slug.trim().toLowerCase();

    try {
      const site = await this.prisma.site.create({
        data: {
          name: dto.name.trim(),
          slug: normalizedSlug,
          description: dto.description?.trim() || null,
          ownerId: userId,
          themeId: dto.themeId || 'minimal-blog',
          themeConfig: (dto.themeConfig || {}) as Prisma.InputJsonValue,
        },
      });

      return site as SiteResponse;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A site with this slug already exists.');
      }
      throw err;
    }
  }

  /**
   * Lists all sites owned by the authenticated user.
   */
  async listSites(userId: string): Promise<SiteResponse[]> {
    const sites = await this.prisma.site.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return sites as SiteResponse[];
  }

  /**
   * Retrieves a site by ID, strictly scoped to the owner in the database query.
   * Never fetches by siteId alone and checks ownership afterward.
   */
  async getSite(userId: string, siteId: string): Promise<SiteResponse> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        ownerId: userId,
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found.');
    }

    return site as SiteResponse;
  }

  /**
   * Updates a site by ID, strictly scoped to the owner in both the write and the follow-up read query.
   * Normalizes updated slugs and catches P2002 unique constraint violations at the write boundary.
   */
  async updateSite(userId: string, siteId: string, dto: UpdateSiteDto): Promise<SiteResponse> {
    if (dto.themeId && !THEME_IDS.includes(dto.themeId as ThemeId)) {
      throw new BadRequestException(`Invalid themeId. Must be one of: ${THEME_IDS.join(', ')}`);
    }

    const normalizedSlug = dto.slug ? dto.slug.trim().toLowerCase() : undefined;

    try {
      // Direct owner-scoped write: where id = siteId AND ownerId = userId
      const updateResult = await this.prisma.site.updateMany({
        where: {
          id: siteId,
          ownerId: userId,
        },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(normalizedSlug ? { slug: normalizedSlug } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.themeId ? { themeId: dto.themeId } : {}),
          ...(dto.themeConfig ? { themeConfig: dto.themeConfig as Prisma.InputJsonValue } : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Site not found.');
      }

      // Owner-scoped follow-up read
      const updated = await this.prisma.site.findFirst({
        where: {
          id: siteId,
          ownerId: userId,
        },
      });

      if (!updated) {
        throw new NotFoundException('Site not found.');
      }

      return updated as SiteResponse;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A site with this slug already exists.');
      }
      throw err;
    }
  }

  /**
   * Retrieves a public site by slug, returning only PUBLISHED pages and PUBLISHED posts.
   */
  async getPublicSiteBySlug(slug: string): Promise<PublicSiteResponse> {
    const normalizedSlug = slug.trim().toLowerCase();
    const site = await this.prisma.site.findUnique({
      where: { slug: normalizedSlug },
      include: {
        pages: {
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'asc' },
        },
        posts: {
          where: { status: 'PUBLISHED' },
          include: { coverImage: true },
          orderBy: { publishedAt: 'desc' },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found.');
    }

    return {
      id: site.id,
      slug: site.slug,
      name: site.name,
      description: site.description,
      themeId: site.themeId,
      themeConfig: site.themeConfig as JsonObject,
      pages: site.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        isHomepage: p.isHomepage,
        contentJson: p.contentJson as JsonObject,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        updatedAt: p.updatedAt,
      })),
      posts: site.posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImageUrl: p.coverImage?.publicUrl ?? null,
        contentJson: p.contentJson as JsonObject,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
      })),
    };
  }
}
