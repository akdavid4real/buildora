import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@buildora/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: {
    site: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    mediaAsset: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    post: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      site: {
        findFirst: vi.fn(),
      },
      mediaAsset: {
        findFirst: vi.fn(),
      },
      post: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PostsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  describe('createPost', () => {
    it('should throw NotFoundException if site is not found or not owned by user', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.createPost('user-1', 'site-1', {
          title: 'First Post',
          slug: 'first-post',
          contentJson: { type: 'doc', content: [] },
          status: 'DRAFT',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject creation if coverImageId does not belong to the site', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      prisma.mediaAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.createPost('user-1', 'site-1', {
          title: 'First Post',
          slug: 'first-post',
          coverImageId: 'foreign-media-id',
          contentJson: { type: 'doc', content: [] },
          status: 'DRAFT',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'foreign-media-id',
          siteId: 'site-1',
          site: {
            ownerId: 'user-1',
          },
        },
      });
    });

    it('should create post with normalized slug and valid cover image relation', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'media-1',
        siteId: 'site-1',
        publicUrl: 'https://cdn.example.com/cover.jpg',
      });
      prisma.post.create.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        title: 'First Post',
        slug: 'first-post',
        coverImageId: 'media-1',
        coverImage: {
          publicUrl: 'https://cdn.example.com/cover.jpg',
        },
        contentJson: { type: 'doc', content: [] },
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPost('user-1', 'site-1', {
        title: 'First Post',
        slug: '  FIRST-POST  ',
        coverImageId: 'media-1',
        contentJson: { type: 'doc', content: [] },
        status: 'PUBLISHED',
      });

      expect(result.id).toBe('post-1');
      expect(result.slug).toBe('first-post');
      expect(result.coverImageUrl).toBe('https://cdn.example.com/cover.jpg');
      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId: 'site-1',
            slug: 'first-post',
            coverImageId: 'media-1',
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should map P2002 slug collision to ConflictException on create', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.post.create.mockRejectedValue(p2002);

      await expect(
        service.createPost('user-1', 'site-1', {
          title: 'Duplicate Post',
          slug: 'duplicate',
          contentJson: { type: 'doc', content: [] },
          status: 'DRAFT',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listPosts', () => {
    it('should list posts with pagination and deterministic ordering', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      prisma.post.count.mockResolvedValue(15);
      prisma.post.findMany.mockResolvedValue([
        { id: 'post-1', title: 'Post 1', contentJson: { type: 'doc', content: [] } },
        { id: 'post-2', title: 'Post 2', contentJson: { type: 'doc', content: [] } },
      ]);

      const result = await service.listPosts('user-1', 'site-1', {
        page: 1,
        limit: 10,
      });

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
      });
      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: { siteId: 'site-1' },
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { coverImage: true },
      });
    });

    it('should filter posts by status and search query', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      prisma.post.count.mockResolvedValue(1);
      prisma.post.findMany.mockResolvedValue([
        { id: 'post-1', title: 'Tech Trends', contentJson: { type: 'doc', content: [] } },
      ]);

      await service.listPosts('user-1', 'site-1', {
        page: 1,
        limit: 20,
        status: 'PUBLISHED',
        search: 'trends',
      });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            siteId: 'site-1',
            status: 'PUBLISHED',
            OR: [
              { title: { contains: 'trends', mode: 'insensitive' } },
              { slug: { contains: 'trends', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('getPost', () => {
    it('should retrieve a single post scoped to owner site with cover image resolved', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        title: 'Post One',
        coverImageId: 'media-1',
        coverImage: {
          publicUrl: 'https://cdn.example.com/cover.png',
        },
        contentJson: { type: 'doc', content: [] },
      });

      const result = await service.getPost('user-1', 'site-1', 'post-1');

      expect(result.id).toBe('post-1');
      expect(result.coverImageUrl).toBe('https://cdn.example.com/cover.png');
      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'post-1',
          siteId: 'site-1',
          site: {
            ownerId: 'user-1',
          },
        },
        include: {
          coverImage: true,
        },
      });
    });

    it('should throw NotFoundException if post is not found or not owned', async () => {
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.getPost('user-1', 'site-1', 'post-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePost', () => {
    it('should validate cover image and normalize slug on update', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'media-2',
        siteId: 'site-1',
        publicUrl: 'https://cdn.example.com/media-2.jpg',
      });
      prisma.post.update.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        title: 'Updated Post',
        slug: 'updated-post',
        coverImageId: 'media-2',
        coverImage: {
          publicUrl: 'https://cdn.example.com/media-2.jpg',
        },
        contentJson: { type: 'doc', content: [] },
      });

      const result = await service.updatePost('user-1', 'site-1', 'post-1', {
        title: 'Updated Post',
        slug: '  UPDATED-POST  ',
        coverImageId: 'media-2',
      });

      expect(result.slug).toBe('updated-post');
      expect(result.coverImageUrl).toBe('https://cdn.example.com/media-2.jpg');
      expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'media-2',
          siteId: 'site-1',
          site: {
            ownerId: 'user-1',
          },
        },
      });
    });

    it('should map P2002 error to ConflictException on update', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.post.update.mockRejectedValue(p2002);

      await expect(
        service.updatePost('user-1', 'site-1', 'post-1', {
          slug: 'collision-slug',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publishPost and unpublishPost', () => {
    it('should set status to PUBLISHED and set publishedAt timestamp', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      prisma.post.update.mockResolvedValue({
        id: 'post-1',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        contentJson: { type: 'doc', content: [] },
      });

      const result = await service.publishPost('user-1', 'site-1', 'post-1');

      expect(result.status).toBe('PUBLISHED');
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: {
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
          },
        }),
      );
    });

    it('should set status to DRAFT and clear publishedAt timestamp', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
        status: 'PUBLISHED',
      });
      prisma.post.update.mockResolvedValue({
        id: 'post-1',
        status: 'DRAFT',
        publishedAt: null,
        contentJson: { type: 'doc', content: [] },
      });

      const result = await service.unpublishPost('user-1', 'site-1', 'post-1');

      expect(result.status).toBe('DRAFT');
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: {
            status: 'DRAFT',
            publishedAt: null,
          },
        }),
      );
    });
  });

  describe('deletePost', () => {
    it('should delete post when owned by user', async () => {
      prisma.post.findFirst.mockResolvedValue({
        id: 'post-1',
        siteId: 'site-1',
      });
      prisma.post.delete.mockResolvedValue({ id: 'post-1' });

      await service.deletePost('user-1', 'site-1', 'post-1');

      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
    });

    it('should throw NotFoundException on delete if post is not found or not owned', async () => {
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.deletePost('user-1', 'site-1', 'post-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
