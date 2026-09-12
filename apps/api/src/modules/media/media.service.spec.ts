import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';
import { S3StorageService } from './s3-storage.service';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: {
    site: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    mediaAsset: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let s3Storage: {
    generatePresignedUploadUrl: ReturnType<typeof vi.fn>;
    buildPublicUrl: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
    isConfigured: ReturnType<typeof vi.fn>;
  };

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const siteId = '660e8400-e29b-41d4-a716-446655440000';
  const mediaId = '770e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    prisma = {
      site: {
        findFirst: vi.fn(),
      },
      mediaAsset: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    s3Storage = {
      generatePresignedUploadUrl: vi.fn(),
      buildPublicUrl: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageService, useValue: s3Storage },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('ownership enforcement', () => {
    it('should throw NotFoundException if user does not own the site on requestUpload', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.requestUpload(userId, siteId, {
          filename: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not own the site on confirmUpload', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: `sites/${siteId}/media/photo.png`,
          originalFilename: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not own the site on deleteMedia', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(service.deleteMedia(userId, siteId, mediaId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestUpload', () => {
    it('should reject disallowed MIME types', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });

      await expect(
        service.requestUpload(userId, siteId, {
          filename: 'vector.svg',
          mimeType: 'image/svg+xml' as never,
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });

      await expect(
        service.requestUpload(userId, siteId, {
          filename: 'giant.png',
          mimeType: 'image/png',
          sizeBytes: 11 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate an unpredictable site-scoped S3 key and presigned upload URL', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      s3Storage.generatePresignedUploadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/presigned-put-url',
      );
      s3Storage.buildPublicUrl.mockImplementation(
        (key: string) => `https://cdn.buildora.app/${key}`,
      );

      const result = await service.requestUpload(userId, siteId, {
        filename: 'my hero banner.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
      });

      expect(result.uploadUrl).toBe('https://s3.amazonaws.com/presigned-put-url');
      expect(result.s3Key).toMatch(
        new RegExp(`^sites/${siteId}/media/[a-f0-9-]+-my_hero_banner\\.png$`),
      );
      expect(result.publicUrl).toContain(result.s3Key);
      expect(result.expiresInSeconds).toBe(900);
      expect(s3Storage.generatePresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          s3Key: result.s3Key,
          mimeType: 'image/png',
          sizeBytes: 2048,
        }),
      );
    });
  });

  describe('confirmUpload', () => {
    it('should reject S3 keys that do not belong to the current site', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: 'sites/different-site-id/media/123-pic.jpg',
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if S3 key is already registered in DB', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/abc-pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'existing-id', s3Key: validKey });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should verify object exists via HeadObject and create MediaAsset record', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/abc-pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockResolvedValue({
        contentLength: 4096,
        contentType: 'image/jpeg',
      });
      s3Storage.buildPublicUrl.mockReturnValue(`https://cdn.buildora.app/${validKey}`);

      const now = new Date();
      prisma.mediaAsset.create.mockResolvedValue({
        id: mediaId,
        siteId,
        uploaderId: userId,
        filename: 'pic.jpg',
        originalFilename: 'pic.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4096,
        s3Key: validKey,
        publicUrl: `https://cdn.buildora.app/${validKey}`,
        width: 800,
        height: 600,
        altText: 'A lovely photograph',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.confirmUpload(userId, siteId, {
        s3Key: validKey,
        originalFilename: 'pic.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4096,
        width: 800,
        height: 600,
        altText: 'A lovely photograph',
      });

      expect(s3Storage.headObject).toHaveBeenCalledWith(validKey);
      expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId,
            uploaderId: userId,
            s3Key: validKey,
            mimeType: 'image/jpeg',
            sizeBytes: 4096,
            altText: 'A lovely photograph',
          }),
        }),
      );
      expect(result.id).toBe(mediaId);
      expect(result.altText).toBe('A lovely photograph');
    });

    it('should fail if HeadObject throws NotFoundException (file not in S3)', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/missing-pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockRejectedValue(new NotFoundException('Object not found'));

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'missing-pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if HeadObject is missing ContentLength', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockResolvedValue({
        contentLength: undefined,
        contentType: 'image/jpeg',
      });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if HeadObject is missing ContentType', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockResolvedValue({
        contentLength: 4096,
        contentType: undefined,
      });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if HeadObject ContentLength does not match dto.sizeBytes', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockResolvedValue({
        contentLength: 5000,
        contentType: 'image/jpeg',
      });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if HeadObject ContentType does not match dto.mimeType', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const validKey = `sites/${siteId}/media/pic.jpg`;
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      s3Storage.headObject.mockResolvedValue({
        contentLength: 4096,
        contentType: 'image/png',
      });

      await expect(
        service.confirmUpload(userId, siteId, {
          s3Key: validKey,
          originalFilename: 'pic.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMedia', () => {
    it('should throw ConflictException (409) if media is used as cover image for posts', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: mediaId,
        siteId,
        s3Key: `sites/${siteId}/media/test.jpg`,
        coverForPosts: [{ id: 'post-1', title: 'First Post' }],
      });

      await expect(service.deleteMedia(userId, siteId, mediaId)).rejects.toThrow(ConflictException);
      expect(s3Storage.deleteObject).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    });

    it('should successfully delete S3 object and DB record when not used as cover', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      const s3Key = `sites/${siteId}/media/test.jpg`;
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: mediaId,
        siteId,
        s3Key,
        coverForPosts: [],
      });
      s3Storage.deleteObject.mockResolvedValue(undefined);
      prisma.mediaAsset.delete.mockResolvedValue({ id: mediaId });

      await service.deleteMedia(userId, siteId, mediaId);

      expect(s3Storage.deleteObject).toHaveBeenCalledWith(s3Key);
      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: mediaId } });
    });
  });

  describe('listMedia and updateMedia', () => {
    it('should return paginated list of media assets for site', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      prisma.mediaAsset.count.mockResolvedValue(1);
      prisma.mediaAsset.findMany.mockResolvedValue([
        {
          id: mediaId,
          siteId,
          uploaderId: userId,
          filename: 'photo.jpg',
          originalFilename: 'photo.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          s3Key: `sites/${siteId}/media/photo.jpg`,
          publicUrl: `https://cdn.buildora.app/sites/${siteId}/media/photo.jpg`,
          width: null,
          height: null,
          altText: 'Old alt',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listMedia(userId, siteId, {
        page: 1,
        limit: 10,
        search: 'photo',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should update alt text on owned media asset', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: mediaId,
        siteId,
        uploaderId: userId,
        filename: 'photo.jpg',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        s3Key: `sites/${siteId}/media/photo.jpg`,
        publicUrl: `https://cdn.buildora.app/sites/${siteId}/media/photo.jpg`,
        width: null,
        height: null,
        altText: 'Old alt',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.mediaAsset.update.mockResolvedValue({
        id: mediaId,
        siteId,
        uploaderId: userId,
        filename: 'photo.jpg',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        s3Key: `sites/${siteId}/media/photo.jpg`,
        publicUrl: `https://cdn.buildora.app/sites/${siteId}/media/photo.jpg`,
        width: null,
        height: null,
        altText: 'New descriptive alt text',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateMedia(userId, siteId, mediaId, {
        altText: 'New descriptive alt text',
      });

      expect(result.altText).toBe('New descriptive alt text');
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId },
          data: { altText: 'New descriptive alt text' },
        }),
      );
    });
  });
});
