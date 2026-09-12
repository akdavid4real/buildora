import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@buildora/database';
import type { CreateSiteDto } from '@buildora/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SitesService } from './sites.service';

describe('SitesService', () => {
  let service: SitesService;
  let prisma: {
    site: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      site: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SitesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SitesService>(SitesService);
  });

  describe('createSite', () => {
    it('should create site owned by user', async () => {
      prisma.site.create.mockResolvedValue({
        id: 'site-1',
        name: 'My Blog',
        slug: 'my-blog',
        ownerId: 'user-1',
        themeId: 'minimal-blog',
        themeConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSite('user-1', {
        name: 'My Blog',
        slug: 'my-blog',
        themeId: 'minimal-blog',
      });

      expect(result.id).toBe('site-1');
      expect(prisma.site.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'user-1',
            slug: 'my-blog',
          }),
        }),
      );
    });

    it('should reject invalid themeId', async () => {
      await expect(
        service.createSite('user-1', {
          name: 'My Blog',
          slug: 'my-blog',
          themeId: 'invalid-theme' as unknown as CreateSiteDto['themeId'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if P2002 slug collision occurs', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.site.create.mockRejectedValue(p2002Error);

      await expect(
        service.createSite('user-1', {
          name: 'My Blog',
          slug: 'my-blog',
          themeId: 'minimal-blog',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listSites', () => {
    it('should query sites strictly by ownerId', async () => {
      prisma.site.findMany.mockResolvedValue([
        { id: 'site-1', ownerId: 'user-1', name: 'Site 1' },
        { id: 'site-2', ownerId: 'user-1', name: 'Site 2' },
      ]);

      const result = await service.listSites('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.site.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getSite', () => {
    it('should retrieve site strictly scoped by id and ownerId in SQL query', async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: 'site-1',
        ownerId: 'user-1',
        name: 'My Site',
      });

      const result = await service.getSite('user-1', 'site-1');

      expect(result.id).toBe('site-1');
      expect(prisma.site.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'site-1',
          ownerId: 'user-1',
        },
      });
    });

    it('should throw NotFoundException if site is owned by another user', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(service.getSite('user-1', 'site-owned-by-user-2')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.site.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'site-owned-by-user-2',
          ownerId: 'user-1',
        },
      });
    });
  });

  describe('updateSite', () => {
    it('should perform write and follow-up read strictly scoped by id and ownerId', async () => {
      prisma.site.updateMany.mockResolvedValue({ count: 1 });
      prisma.site.findFirst.mockResolvedValue({
        id: 'site-1',
        ownerId: 'user-1',
        name: 'New Name',
        slug: 'old-slug',
      });

      const result = await service.updateSite('user-1', 'site-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(prisma.site.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'site-1',
          ownerId: 'user-1',
        },
        data: expect.objectContaining({
          name: 'New Name',
        }),
      });
      expect(prisma.site.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'site-1',
          ownerId: 'user-1',
        },
      });
    });

    it('should normalize updated slug (trim + lowercase) and include in owner-scoped write', async () => {
      prisma.site.updateMany.mockResolvedValue({ count: 1 });
      prisma.site.findFirst.mockResolvedValue({
        id: 'site-1',
        ownerId: 'user-1',
        name: 'Updated Site',
        slug: 'new-updated-slug',
      });

      const result = await service.updateSite('user-1', 'site-1', {
        slug: '  NEW-UPDATED-SLUG  ',
      });

      expect(result.slug).toBe('new-updated-slug');
      expect(prisma.site.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'site-1',
          ownerId: 'user-1',
        },
        data: expect.objectContaining({
          slug: 'new-updated-slug',
        }),
      });
    });

    it('should throw NotFoundException if updateMany matches 0 records for user', async () => {
      prisma.site.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateSite('user-1', 'site-owned-by-user-2', { name: 'Hack Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on P2002 slug collision during update write', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.site.updateMany.mockRejectedValue(p2002Error);

      await expect(
        service.updateSite('user-1', 'site-1', { slug: 'already-taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getPublicSiteBySlug', () => {
    it('should retrieve site with only published pages and published posts', async () => {
      const mockPublishedSite = {
        id: 'site-1',
        slug: 'my-site',
        name: 'My Site',
        description: 'Site Description',
        themeId: 'minimal-blog',
        themeConfig: { accentColor: '#174d3e' },
        pages: [
          {
            id: 'page-1',
            title: 'Home',
            slug: '',
            isHomepage: true,
            contentJson: { type: 'doc', content: [] },
            seoTitle: 'Home SEO',
            seoDescription: 'Home Description',
            updatedAt: new Date('2026-09-01'),
          },
        ],
        posts: [
          {
            id: 'post-1',
            title: 'First Post',
            slug: 'first-post',
            excerpt: 'Excerpt here',
            coverImage: { publicUrl: 'https://cdn.example.com/cover.jpg' },
            contentJson: { type: 'doc', content: [] },
            seoTitle: 'Post SEO',
            seoDescription: 'Post Description',
            publishedAt: new Date('2026-09-02'),
            updatedAt: new Date('2026-09-02'),
          },
        ],
      };

      prisma.site.findUnique.mockResolvedValue(mockPublishedSite);

      const result = await service.getPublicSiteBySlug('MY-SITE');

      expect(prisma.site.findUnique).toHaveBeenCalledWith({
        where: { slug: 'my-site' },
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

      expect(result.id).toBe('site-1');
      expect(result.slug).toBe('my-site');
      expect(result.pages).toHaveLength(1);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].coverImageUrl).toBe('https://cdn.example.com/cover.jpg');
    });

    it('should throw NotFoundException if site slug does not exist', async () => {
      prisma.site.findUnique.mockResolvedValue(null);

      await expect(service.getPublicSiteBySlug('unknown-slug')).rejects.toThrow(NotFoundException);
    });
  });
});
