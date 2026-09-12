import { z } from 'zod';
import {
  EMPTY_TIPTAP_DOC,
  contentSlugSchema,
  contentStatusSchema,
  tiptapDocSchema,
} from './common';

export const createPostSchema = z.object({
  title: z
    .string({ required_error: 'Post title is required' })
    .trim()
    .min(1, 'Post title cannot be empty')
    .max(150, 'Post title must not exceed 150 characters'),
  slug: contentSlugSchema,
  excerpt: z
    .string()
    .trim()
    .max(500, 'Excerpt must not exceed 500 characters')
    .nullable()
    .optional(),
  coverImageId: z.string().uuid('Cover image must be a valid MediaAsset ID').nullable().optional(),
  contentJson: tiptapDocSchema.default(EMPTY_TIPTAP_DOC),
  status: contentStatusSchema.default('DRAFT'),
  seoTitle: z
    .string()
    .trim()
    .max(70, 'SEO title must not exceed 70 characters')
    .nullable()
    .optional(),
  seoDescription: z
    .string()
    .trim()
    .max(160, 'SEO description must not exceed 160 characters')
    .nullable()
    .optional(),
});

export type CreatePostDto = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  title: z.string().trim().min(1, 'Post title cannot be empty').max(150).optional(),
  slug: contentSlugSchema.optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  coverImageId: z.string().uuid('Cover image must be a valid MediaAsset ID').nullable().optional(),
  contentJson: tiptapDocSchema.optional(),
  status: contentStatusSchema.optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
});

export type UpdatePostDto = z.infer<typeof updatePostSchema>;

export const postResponseSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  coverImageId: z.string().uuid().nullable(),
  coverImageUrl: z.string().url().nullable().optional(),
  contentJson: tiptapDocSchema,
  status: contentStatusSchema,
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PostResponse = z.infer<typeof postResponseSchema>;

export const postListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: contentStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export type PostListQuery = z.infer<typeof postListQuerySchema>;
