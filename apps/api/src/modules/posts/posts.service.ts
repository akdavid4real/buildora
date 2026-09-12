import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type MediaAsset, type Post, Prisma } from '@buildora/database';
import {
  type CreatePostDto,
  EMPTY_TIPTAP_DOC,
  type PaginatedResponse,
  type PostListQuery,
  type PostResponse,
  type UpdatePostDto,
} from '@buildora/contracts';
import { PrismaService } from '../prisma/prisma.service';

type PostWithRelations = Post & {
  coverImage?: MediaAsset | null;
};

@Injectable()
export class PostsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Transforms internal Post entity (and optional MediaAsset relation) into PostResponse.
   */
  private formatPostResponse(post: PostWithRelations): PostResponse {
    return {
      id: post.id,
      siteId: post.siteId,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageId: post.coverImageId,
      coverImageUrl: post.coverImage?.publicUrl || null,
      contentJson: post.contentJson as PostResponse['contentJson'],
      status: post.status,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

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
   * Verifies that the referenced media asset belongs to the same owned site.
   */
  private async verifyCoverImage(
    userId: string,
    siteId: string,
    coverImageId: string,
  ): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: {
        id: coverImageId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!media) {
      throw new BadRequestException(
        'Referenced cover image does not exist or does not belong to this site.',
      );
    }
  }

  /**
   * Creates a new post for a site.
   * Scopes cover image reference to the same site and maps P2002 collisions to 409.
   */
  async createPost(userId: string, siteId: string, dto: CreatePostDto): Promise<PostResponse> {
    await this.verifySiteOwnership(userId, siteId);

    if (dto.coverImageId) {
      await this.verifyCoverImage(userId, siteId, dto.coverImageId);
    }

    const normalizedSlug = dto.slug.trim().toLowerCase();
    const publishedAt = dto.status === 'PUBLISHED' ? new Date() : null;

    try {
      const post = await this.prisma.post.create({
        data: {
          siteId,
          title: dto.title.trim(),
          slug: normalizedSlug,
          excerpt: dto.excerpt?.trim() || null,
          coverImageId: dto.coverImageId || null,
          contentJson: (dto.contentJson || EMPTY_TIPTAP_DOC) as Prisma.InputJsonValue,
          status: dto.status || 'DRAFT',
          seoTitle: dto.seoTitle?.trim() || null,
          seoDescription: dto.seoDescription?.trim() || null,
          publishedAt,
        },
        include: {
          coverImage: true,
        },
      });

      return this.formatPostResponse(post);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A post with this slug already exists for this site.');
      }
      throw err;
    }
  }

  /**
   * Lists posts for a site with deterministic pagination and filtering.
   */
  async listPosts(
    userId: string,
    siteId: string,
    query: PostListQuery,
  ): Promise<PaginatedResponse<PostResponse>> {
    await this.verifySiteOwnership(userId, siteId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {
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
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          coverImage: true,
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items.map((item) => this.formatPostResponse(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single post by ID, verified through owner-scoped site relation.
   */
  async getPost(userId: string, siteId: string, postId: string): Promise<PostResponse> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
      include: {
        coverImage: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return this.formatPostResponse(post);
  }

  /**
   * Updates an existing post.
   * Handles cover image validation, slug normalization, and status/publishedAt consistency.
   */
  async updatePost(
    userId: string,
    siteId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<PostResponse> {
    const existing = await this.prisma.post.findFirst({
      where: {
        id: postId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    if (dto.coverImageId) {
      await this.verifyCoverImage(userId, siteId, dto.coverImageId);
    }

    const normalizedSlug = dto.slug ? dto.slug.trim().toLowerCase() : undefined;

    let publishedAtUpdate: { publishedAt?: Date | null } = {};
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedAtUpdate = { publishedAt: new Date() };
    } else if (dto.status === 'DRAFT' && existing.status !== 'DRAFT') {
      publishedAtUpdate = { publishedAt: null };
    }

    try {
      const updated = await this.prisma.post.update({
        where: { id: postId },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          ...(normalizedSlug ? { slug: normalizedSlug } : {}),
          ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt?.trim() || null } : {}),
          ...(dto.coverImageId !== undefined ? { coverImageId: dto.coverImageId } : {}),
          ...(dto.contentJson ? { contentJson: dto.contentJson as Prisma.InputJsonValue } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...publishedAtUpdate,
          ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle?.trim() || null } : {}),
          ...(dto.seoDescription !== undefined
            ? { seoDescription: dto.seoDescription?.trim() || null }
            : {}),
        },
        include: {
          coverImage: true,
        },
      });

      return this.formatPostResponse(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A post with this slug already exists for this site.');
      }
      throw err;
    }
  }

  /**
   * Deletes a post, strictly verifying site ownership.
   */
  async deletePost(userId: string, siteId: string, postId: string): Promise<void> {
    const existing = await this.prisma.post.findFirst({
      where: {
        id: postId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });
  }

  /**
   * Publishes a post, setting status to PUBLISHED and publishedAt to current timestamp.
   */
  async publishPost(userId: string, siteId: string, postId: string): Promise<PostResponse> {
    const existing = await this.prisma.post.findFirst({
      where: {
        id: postId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      include: {
        coverImage: true,
      },
    });

    return this.formatPostResponse(updated);
  }

  /**
   * Unpublishes a post, setting status to DRAFT and publishedAt to null.
   */
  async unpublishPost(userId: string, siteId: string, postId: string): Promise<PostResponse> {
    const existing = await this.prisma.post.findFirst({
      where: {
        id: postId,
        siteId,
        site: {
          ownerId: userId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'DRAFT',
        publishedAt: null,
      },
      include: {
        coverImage: true,
      },
    });

    return this.formatPostResponse(updated);
  }
}
