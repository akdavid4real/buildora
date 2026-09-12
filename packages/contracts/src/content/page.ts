import { z } from 'zod';
import {
  EMPTY_TIPTAP_DOC,
  contentSlugSchema,
  contentStatusSchema,
  tiptapDocSchema,
} from './common';

/**
 * Note: The invariant of at most one homepage per site must be enforced
 * transactionally in the application service layer (e.g. unsetting any existing
 * homepage when a new one is designated as isHomepage: true).
 */
export const createPageSchema = z.object({
  title: z
    .string({ required_error: 'Page title is required' })
    .trim()
    .min(1, 'Page title cannot be empty')
    .max(150, 'Page title must not exceed 150 characters'),
  slug: contentSlugSchema,
  contentJson: tiptapDocSchema.default(EMPTY_TIPTAP_DOC),
  status: contentStatusSchema.default('DRAFT'),
  isHomepage: z.boolean().default(false),
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

export type CreatePageDto = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: z.string().trim().min(1, 'Page title cannot be empty').max(150).optional(),
  slug: contentSlugSchema.optional(),
  contentJson: tiptapDocSchema.optional(),
  status: contentStatusSchema.optional(),
  isHomepage: z.boolean().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
});

export type UpdatePageDto = z.infer<typeof updatePageSchema>;

export const pageResponseSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  contentJson: tiptapDocSchema,
  status: contentStatusSchema,
  isHomepage: z.boolean(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PageResponse = z.infer<typeof pageResponseSchema>;

export const pageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: contentStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export type PageListQuery = z.infer<typeof pageListQuerySchema>;
