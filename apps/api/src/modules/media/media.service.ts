import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type MediaAsset, Prisma } from '@buildora/database';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_SIZE_BYTES,
  type ConfirmMediaUploadDto,
  type MediaAssetResponse,
  type MediaListQuery,
  type PaginatedResponse,
  type RequestMediaUploadDto,
  type RequestMediaUploadResponse,
  type UpdateMediaAssetDto,
} from '@buildora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from './s3-storage.service';

type MediaAssetWithRelations = MediaAsset & {
  coverForPosts?: { id: string; title: string }[];
};

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3StorageService) private readonly s3Storage: S3StorageService,
  ) {}

  /**
   * Transforms internal MediaAsset entity into MediaAssetResponse contract.
   */
  private formatMediaResponse(asset: MediaAsset): MediaAssetResponse {
    return {
      id: asset.id,
      siteId: asset.siteId,
      uploaderId: asset.uploaderId,
      filename: asset.filename,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      s3Key: asset.s3Key,
      publicUrl: asset.publicUrl,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  /**
   * Verifies that the site exists and is owned by the requesting user.
   */
  private async verifySiteOwnership(userId: string, siteId: string): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        ownerId: userId,
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  /**
   * Generates an unpredictable site-scoped S3 key and presigned upload URL.
   */
  async requestUpload(
    userId: string,
    siteId: string,
    dto: RequestMediaUploadDto,
  ): Promise<RequestMediaUploadResponse> {
    await this.verifySiteOwnership(userId, siteId);

    if (!(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(dto.mimeType)) {
      throw new BadRequestException(
        `Invalid MIME type. Allowed raster types: ${ALLOWED_MEDIA_MIME_TYPES.join(', ')}`,
      );
    }

    if (dto.sizeBytes > MAX_MEDIA_SIZE_BYTES) {
      throw new BadRequestException('File size must not exceed 10MB');
    }

    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const randomId = crypto.randomUUID();
    const s3Key = `sites/${siteId}/media/${randomId}-${sanitizedFilename}`;
    const expiresInSeconds = 900;

    const uploadUrl = await this.s3Storage.generatePresignedUploadUrl({
      s3Key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      expiresInSeconds,
    });

    const publicUrl = this.s3Storage.buildPublicUrl(s3Key);

    return {
      uploadUrl,
      s3Key,
      publicUrl,
      expiresInSeconds,
    };
  }

  /**
   * Confirms upload by verifying key site scoping, proving object existence via HeadObject,
   * and persisting the MediaAsset in the database.
   */
  async confirmUpload(
    userId: string,
    siteId: string,
    dto: ConfirmMediaUploadDto,
  ): Promise<MediaAssetResponse> {
    await this.verifySiteOwnership(userId, siteId);

    const expectedPrefix = `sites/${siteId}/media/`;
    if (!dto.s3Key.startsWith(expectedPrefix)) {
      throw new BadRequestException('S3 storage key does not belong to the specified site');
    }

    const existingAsset = await this.prisma.mediaAsset.findUnique({
      where: { s3Key: dto.s3Key },
    });

    if (existingAsset) {
      throw new ConflictException('Media asset with this storage key has already been confirmed');
    }

    const head = await this.s3Storage.headObject(dto.s3Key);

    if (head.contentLength === undefined || head.contentLength === null) {
      throw new BadRequestException(
        'Uploaded object is missing Content-Length metadata in storage',
      );
    }

    if (!head.contentType) {
      throw new BadRequestException('Uploaded object is missing Content-Type metadata in storage');
    }

    const normalizedHeadContentType = head.contentType.toLowerCase().split(';')[0].trim();
    const normalizedDtoMimeType = dto.mimeType.toLowerCase().split(';')[0].trim();

    if (normalizedHeadContentType !== normalizedDtoMimeType) {
      throw new BadRequestException(
        `Uploaded object Content-Type (${normalizedHeadContentType}) does not match expected MIME type (${normalizedDtoMimeType})`,
      );
    }

    if (head.contentLength !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded object Content-Length (${head.contentLength}) does not match expected size (${dto.sizeBytes})`,
      );
    }

    if (head.contentLength > MAX_MEDIA_SIZE_BYTES) {
      throw new BadRequestException('Uploaded object exceeds the 10MB limit');
    }

    if (!(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(normalizedHeadContentType)) {
      throw new BadRequestException('Uploaded object has an invalid or disallowed MIME type');
    }

    const publicUrl = this.s3Storage.buildPublicUrl(dto.s3Key);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        siteId,
        uploaderId: userId,
        filename: dto.originalFilename,
        originalFilename: dto.originalFilename,
        mimeType: normalizedHeadContentType,
        sizeBytes: head.contentLength,
        s3Key: dto.s3Key,
        publicUrl,
        width: dto.width ?? null,
        height: dto.height ?? null,
        altText: dto.altText ?? null,
      },
    });

    return this.formatMediaResponse(asset);
  }

  /**
   * Lists media assets for an owned site with pagination and optional search filter.
   */
  async listMedia(
    userId: string,
    siteId: string,
    query: MediaListQuery,
  ): Promise<PaginatedResponse<MediaAssetResponse>> {
    await this.verifySiteOwnership(userId, siteId);

    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MediaAssetWhereInput = {
      siteId,
      ...(search
        ? {
            OR: [
              { originalFilename: { contains: search, mode: 'insensitive' } },
              { altText: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, assets] = await Promise.all([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: assets.map((asset) => this.formatMediaResponse(asset)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single media asset scoped to site ownership.
   */
  async getMedia(userId: string, siteId: string, mediaId: string): Promise<MediaAssetResponse> {
    await this.verifySiteOwnership(userId, siteId);

    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        siteId,
      },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    return this.formatMediaResponse(asset);
  }

  /**
   * Updates media asset alt text.
   */
  async updateMedia(
    userId: string,
    siteId: string,
    mediaId: string,
    dto: UpdateMediaAssetDto,
  ): Promise<MediaAssetResponse> {
    await this.verifySiteOwnership(userId, siteId);

    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        siteId,
      },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        altText: dto.altText !== undefined ? dto.altText : asset.altText,
      },
    });

    return this.formatMediaResponse(updated);
  }

  /**
   * Safely deletes a media asset:
   * Refuses deletion (409 Conflict) if asset is currently linked as a cover image for posts.
   * Deletes object from S3 storage and record from database.
   */
  async deleteMedia(userId: string, siteId: string, mediaId: string): Promise<void> {
    await this.verifySiteOwnership(userId, siteId);

    const asset = (await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        siteId,
      },
      include: {
        coverForPosts: {
          select: { id: true, title: true },
        },
      },
    })) as MediaAssetWithRelations | null;

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.coverForPosts && asset.coverForPosts.length > 0) {
      throw new ConflictException(
        `Cannot delete media asset because it is currently used as a cover image for ${asset.coverForPosts.length} post(s)`,
      );
    }

    await this.s3Storage.deleteObject(asset.s3Key);

    await this.prisma.mediaAsset.delete({
      where: { id: mediaId },
    });
  }
}
