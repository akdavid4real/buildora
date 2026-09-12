import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@buildora/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { PagesService } from './pages.service';

describe('PagesService', () => {
  let service: PagesService;
  let rootPrisma: {
    site: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    page: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let txPrisma: {
    page: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    txPrisma = {
      page: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    rootPrisma = {
      site: {
        findFirst: vi.fn(),
      },
      page: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(txPrisma);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PagesService, { provide: PrismaService, useValue: rootPrisma }],
    }).compile();

    service = module.get<PagesService>(PagesService);
  });

  describe('createPage', () => {
    it('should throw NotFoundException if site is not found or not owned by user', async () => {
      rootPrisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.createPage('user-1', 'site-1', {
          title: 'About Us',
          slug: 'about',
          contentJson: { type: 'doc', content: [] },
          status: 'DRAFT',
          isHomepage: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a non-homepage page with normalized slug', async () => {
      rootPrisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      rootPrisma.page.create.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        title: 'About Us',
        slug: 'about-us',
        isHomepage: false,
        status: 'DRAFT',
      });

      const result = await service.createPage('user-1', 'site-1', {
        title: 'About Us',
        slug: '  ABOUT-US  ',
        contentJson: { type: 'doc', content: [] },
        status: 'DRAFT',
        isHomepage: false,
      });

      expect(result.id).toBe('page-1');
      expect(rootPrisma.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId: 'site-1',
            slug: 'about-us',
            isHomepage: false,
          }),
        }),
      );
    });

    it('should use transaction to clear old homepage when creating new homepage', async () => {
      rootPrisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      txPrisma.page.updateMany.mockResolvedValue({ count: 1 });
      txPrisma.page.create.mockResolvedValue({
        id: 'page-home',
        siteId: 'site-1',
        title: 'Home',
        slug: 'home',
        isHomepage: true,
      });

      const result = await service.createPage('user-1', 'site-1', {
        title: 'Home',
        slug: 'home',
        contentJson: { type: 'doc', content: [] },
        status: 'PUBLISHED',
        isHomepage: true,
      });

      expect(result.id).toBe('page-home');
      expect(rootPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txPrisma.page.updateMany).toHaveBeenCalledWith({
        where: {
          siteId: 'site-1',
          isHomepage: true,
        },
        data: {
          isHomepage: false,
        },
      });
      expect(txPrisma.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isHomepage: true,
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should map P2002 slug collision to ConflictException on create', async () => {
      rootPrisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      rootPrisma.page.create.mockRejectedValue(p2002);

      await expect(
        service.createPage('user-1', 'site-1', {
          title: 'Duplicate Page',
          slug: 'duplicate',
          contentJson: { type: 'doc', content: [] },
          status: 'DRAFT',
          isHomepage: false,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listPages', () => {
    it('should list pages with pagination and deterministic ordering', async () => {
      rootPrisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      rootPrisma.page.count.mockResolvedValue(25);
      rootPrisma.page.findMany.mockResolvedValue([
        { id: 'page-1', title: 'Page 1' },
        { id: 'page-2', title: 'Page 2' },
      ]);

      const result = await service.listPages('user-1', 'site-1', {
        page: 2,
        limit: 10,
      });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(rootPrisma.page.findMany).toHaveBeenCalledWith({
        where: { siteId: 'site-1' },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });

    it('should filter pages by status and search query', async () => {
      rootPrisma.site.findFirst.mockResolvedValue({ id: 'site-1', ownerId: 'user-1' });
      rootPrisma.page.count.mockResolvedValue(1);
      rootPrisma.page.findMany.mockResolvedValue([{ id: 'page-1', title: 'Landing' }]);

      await service.listPages('user-1', 'site-1', {
        page: 1,
        limit: 20,
        status: 'PUBLISHED',
        search: 'landing',
      });

      expect(rootPrisma.page.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            siteId: 'site-1',
            status: 'PUBLISHED',
            OR: [
              { title: { contains: 'landing', mode: 'insensitive' } },
              { slug: { contains: 'landing', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('getPage', () => {
    it('should retrieve a single page strictly scoped to owner site', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        title: 'About',
      });

      const result = await service.getPage('user-1', 'site-1', 'page-1');

      expect(result.id).toBe('page-1');
      expect(rootPrisma.page.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'page-1',
          siteId: 'site-1',
          site: {
            ownerId: 'user-1',
          },
        },
      });
    });

    it('should throw NotFoundException if page is not found or not owned by user', async () => {
      rootPrisma.page.findFirst.mockResolvedValue(null);

      await expect(service.getPage('user-1', 'site-1', 'page-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePage', () => {
    it('should update page and normalize slug', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      rootPrisma.page.update.mockResolvedValue({
        id: 'page-1',
        title: 'New Title',
        slug: 'new-slug',
      });

      const result = await service.updatePage('user-1', 'site-1', 'page-1', {
        title: 'New Title',
        slug: '  NEW-SLUG  ',
      });

      expect(result.id).toBe('page-1');
      expect(rootPrisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
          data: expect.objectContaining({
            title: 'New Title',
            slug: 'new-slug',
          }),
        }),
      );
    });

    it('should switch homepage in transaction when isHomepage is updated to true', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-2',
        siteId: 'site-1',
        isHomepage: false,
        status: 'DRAFT',
      });
      txPrisma.page.updateMany.mockResolvedValue({ count: 1 });
      txPrisma.page.update.mockResolvedValue({
        id: 'page-2',
        isHomepage: true,
      });

      const result = await service.updatePage('user-1', 'site-1', 'page-2', {
        isHomepage: true,
      });

      expect(result.id).toBe('page-2');
      expect(rootPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txPrisma.page.updateMany).toHaveBeenCalledWith({
        where: {
          siteId: 'site-1',
          isHomepage: true,
          id: { not: 'page-2' },
        },
        data: {
          isHomepage: false,
        },
      });
      expect(txPrisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-2' },
          data: expect.objectContaining({
            isHomepage: true,
          }),
        }),
      );
    });

    it('should map P2002 error to ConflictException on update', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      rootPrisma.page.update.mockRejectedValue(p2002);

      await expect(
        service.updatePage('user-1', 'site-1', 'page-1', {
          slug: 'collision-slug',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publishPage and unpublishPage', () => {
    it('should set status to PUBLISHED and set publishedAt timestamp', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        status: 'DRAFT',
      });
      rootPrisma.page.update.mockResolvedValue({
        id: 'page-1',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });

      const result = await service.publishPage('user-1', 'site-1', 'page-1');

      expect(result.id).toBe('page-1');
      expect(rootPrisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
          data: {
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
          },
        }),
      );
    });

    it('should set status to DRAFT and clear publishedAt timestamp', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
        status: 'PUBLISHED',
      });
      rootPrisma.page.update.mockResolvedValue({
        id: 'page-1',
        status: 'DRAFT',
        publishedAt: null,
      });

      const result = await service.unpublishPage('user-1', 'site-1', 'page-1');

      expect(result.id).toBe('page-1');
      expect(rootPrisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
          data: {
            status: 'DRAFT',
            publishedAt: null,
          },
        }),
      );
    });
  });

  describe('deletePage', () => {
    it('should delete page when owned by user', async () => {
      rootPrisma.page.findFirst.mockResolvedValue({
        id: 'page-1',
        siteId: 'site-1',
      });
      rootPrisma.page.delete.mockResolvedValue({ id: 'page-1' });

      await service.deletePage('user-1', 'site-1', 'page-1');

      expect(rootPrisma.page.delete).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });

    it('should throw NotFoundException on delete if page is not found or not owned', async () => {
      rootPrisma.page.findFirst.mockResolvedValue(null);

      await expect(service.deletePage('user-1', 'site-1', 'page-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
