import { z } from 'zod';

/**
 * MVP Allowed Media MIME types: restricted to raster image formats to avoid active-content / XSS risks (e.g. SVG).
 */
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];
export const allowedMediaMimeTypeSchema = z.enum(ALLOWED_MEDIA_MIME_TYPES);

export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes

export const requestMediaUploadSchema = z.object({
  filename: z
    .string({ required_error: 'Filename is required' })
    .trim()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename must not exceed 255 characters'),
  mimeType: allowedMediaMimeTypeSchema,
  sizeBytes: z
    .number({ required_error: 'Size in bytes is required' })
    .int()
    .min(1, 'File size must be greater than 0 bytes')
    .max(MAX_MEDIA_SIZE_BYTES, 'File size must not exceed 10MB'),
});

export type RequestMediaUploadDto = z.infer<typeof requestMediaUploadSchema>;

export const requestMediaUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  s3Key: z.string(),
  publicUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type RequestMediaUploadResponse = z.infer<typeof requestMediaUploadResponseSchema>;

export const confirmMediaUploadSchema = z.object({
  s3Key: z.string().min(1, 'S3 key is required'),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: allowedMediaMimeTypeSchema,
  sizeBytes: z.number().int().min(1).max(MAX_MEDIA_SIZE_BYTES),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  altText: z
    .string()
    .trim()
    .max(255, 'Alt text must not exceed 255 characters')
    .nullable()
    .optional(),
});

export type ConfirmMediaUploadDto = z.infer<typeof confirmMediaUploadSchema>;

export const mediaAssetResponseSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  uploaderId: z.string().uuid(),
  filename: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  s3Key: z.string(),
  publicUrl: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  altText: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type MediaAssetResponse = z.infer<typeof mediaAssetResponseSchema>;

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;

export const updateMediaAssetSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(255, 'Alt text must not exceed 255 characters')
    .nullable()
    .optional(),
});

export type UpdateMediaAssetDto = z.infer<typeof updateMediaAssetSchema>;
