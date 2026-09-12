import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@buildora/database';
import {
  type CreatePageDto,
  EMPTY_TIPTAP_DOC,
  type PageListQuery,
  type PageResponse,
  type PaginatedResponse,
  type UpdatePageDto,
} from '@buildora/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Verifies that the site exists and is owned by the given user.
   */
  private async verifySiteOwnership(userId: string, siteId: string): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        ownerId: userId,
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found.');
    }
  }

  /**
   * Creates a page for a site.
   * If isHomepage is true, atomically clears any existing homepage for the site.
   * Maps Prisma P2002 slug collisions to HTTP 409 ConflictException.
   */
  async createPage(userId: string, siteId: string, dto: CreatePageDto): Promise<PageResponse> {
    await this.verifySiteOwnership(userId, siteId);

    const normalizedSlug = dto.slug.trim().toLowerCase();
    const publishedAt = dto.status === 'PUBLISHED' ? new Date() : null;

    try {
      if (dto.isHomepage) {
        const page = await this.prisma.$transaction(async (tx) => {
          // Clear any existing homepage in this site
          await tx.page.updateMany({
            where: {
              siteId,
              isHomepage: true,
            },
            data: {
              isHomepage: false,
            },
          });

          return tx.page.create({
            data: {
              siteId,
              title: dto.title.trim(),
              slug: normalizedSlug,
              contentJson: (dto.contentJson || EMPTY_TIPTAP_DOC) as Prisma.InputJsonValue,
              status: dto.status || 'DRAFT',
              isHomepage: true,
              seoTitle: dto.seoTitle?.trim() || null,
              seoDescription: dto.seoDescription?.trim() || null,
              publishedAt,
            },
          });
        });

        return page as unknown as PageResponse;
      }

      const page = await this.prisma.page.create({
        data: {
          siteId,
          title: dto.title.trim(),
          slug: normalizedSlug,
          contentJson: (dto.contentJson || EMPTY_TIPTAP_DOC) as Prisma.InputJsonValue,
          status: dto.status || 'DRAFT',
          isHomepage: false,
          seoTitle: dto.seoTitle?.trim() || null,
          seoDescription: dto.seoDescription?.trim() || null,
          publishedAt,
        },
      });

      return page as unknown as PageResponse;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A page with this slug already exists for this site.');
      }
      throw err;
    }
  }

  /**
   * Lists pages for a site with deterministic pagination and filtering.
   */
  async listPages(
    userId: string,
    siteId: string,
    query: PageListQuery,
  ): Promise<PaginatedResponse<PageResponse>> {
    await this.verifySiteOwnership(userId, siteId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PageWhereInput = {
      siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.page.count({ where }),
      this.prisma.page.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items as unknown as PageResponse[],
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single page by ID, verified through owner-scoped site relation.
   */
  async getPage(userId: string, siteId: string, pageId: string): Promise<PageResponse> {
    const page = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found.');
    }

    return page as unknown as PageResponse;
  }

  /**
   * Updates an existing page.
   * Handles slug normalization, homepage transaction switching, and status/publishedAt consistency.
   */
  async updatePage(
    userId: string,
    siteId: string,
    pageId: string,
    dto: UpdatePageDto,
  ): Promise<PageResponse> {
    const existing = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Page not found.');
    }

    const normalizedSlug = dto.slug ? dto.slug.trim().toLowerCase() : undefined;

    let publishedAtUpdate: { publishedAt?: Date | null } = {};
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedAtUpdate = { publishedAt: new Date() };
    } else if (dto.status === 'DRAFT' && existing.status !== 'DRAFT') {
      publishedAtUpdate = { publishedAt: null };
    }

    try {
      if (dto.isHomepage === true) {
        const updated = await this.prisma.$transaction(async (tx) => {
          // Clear any other homepage for this site
          await tx.page.updateMany({
            where: {
              siteId,
              isHomepage: true,
              id: { not: pageId },
            },
            data: {
              isHomepage: false,
            },
          });

          return tx.page.update({
            where: { id: pageId },
            data: {
              ...(dto.title ? { title: dto.title.trim() } : {}),
              ...(normalizedSlug ? { slug: normalizedSlug } : {}),
              ...(dto.contentJson ? { contentJson: dto.contentJson as Prisma.InputJsonValue } : {}),
              ...(dto.status ? { status: dto.status } : {}),
              ...publishedAtUpdate,
              isHomepage: true,
              ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle?.trim() || null } : {}),
              ...(dto.seoDescription !== undefined
                ? { seoDescription: dto.seoDescription?.trim() || null }
                : {}),
            },
          });
        });

        return updated as unknown as PageResponse;
      }

      const updated = await this.prisma.page.update({
        where: { id: pageId },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          ...(normalizedSlug ? { slug: normalizedSlug } : {}),
          ...(dto.contentJson ? { contentJson: dto.contentJson as Prisma.InputJsonValue } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...publishedAtUpdate,
          ...(dto.isHomepage !== undefined ? { isHomepage: dto.isHomepage } : {}),
          ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle?.trim() || null } : {}),
          ...(dto.seoDescription !== undefined
            ? { seoDescription: dto.seoDescription?.trim() || null }
            : {}),
        },
      });

      return updated as unknown as PageResponse;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A page with this slug already exists for this site.');
      }
      throw err;
    }
  }

  /**
   * Deletes a page, strictly verifying site ownership.
   */
  async deletePage(userId: string, siteId: string, pageId: string): Promise<void> {
    const existing = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Page not found.');
    }

    await this.prisma.page.delete({
      where: { id: pageId },
    });
  }

  /**
   * Publishes a page, setting status to PUBLISHED and publishedAt to the current timestamp.
   */
  async publishPage(userId: string, siteId: string, pageId: string): Promise<PageResponse> {
    const existing = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Page not found.');
    }

    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    return updated as unknown as PageResponse;
  }

  /**
   * Unpublishes a page, setting status to DRAFT and publishedAt to null.
   */
  async unpublishPage(userId: string, siteId: string, pageId: string): Promise<PageResponse> {
    const existing = await this.prisma.page.findFirst({
      where: {
        id: pageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Page not found.');
    }

    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: 'DRAFT',
        publishedAt: null,
      },
    });

    return updated as unknown as PageResponse;
  }
}
