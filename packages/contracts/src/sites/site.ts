import { z } from 'zod';
import { type JsonObject, jsonObjectSchema } from '../content/common';
import { RESERVED_SITE_SLUGS, THEME_IDS } from './constants';

export const siteSlugSchema = z
  .string({ required_error: 'Site slug is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters long')
  .max(63, 'Slug must not exceed 63 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug may only contain lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)',
  )
  .refine((slug) => !(RESERVED_SITE_SLUGS as readonly string[]).includes(slug), {
    message: 'This slug is reserved for system routes',
  });

export const createSiteSchema = z.object({
  name: z
    .string({ required_error: 'Site name is required' })
    .trim()
    .min(1, 'Site name cannot be empty')
    .max(100, 'Site name must not exceed 100 characters'),
  slug: siteSlugSchema,
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional(),
  themeId: z.enum(THEME_IDS).default('minimal-blog'),
  themeConfig: jsonObjectSchema.optional(),
});

export type CreateSiteDto = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Site name cannot be empty')
    .max(100, 'Site name must not exceed 100 characters')
    .optional(),
  slug: siteSlugSchema.optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .nullable()
    .optional(),
  themeId: z.enum(THEME_IDS).optional(),
  themeConfig: jsonObjectSchema.optional(),
});

export type UpdateSiteDto = z.infer<typeof updateSiteSchema>;

export const siteResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  themeId: z.string(),
  themeConfig: jsonObjectSchema,
  ownerId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SiteResponse = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  themeId: string;
  themeConfig: JsonObject;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export const publicPageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  isHomepage: z.boolean(),
  contentJson: jsonObjectSchema,
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export type PublicPage = {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  contentJson: JsonObject;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt: Date;
};

export const publicPostSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  contentJson: jsonObjectSchema,
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export type PublicPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  contentJson: JsonObject;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: Date | null;
  updatedAt: Date;
};

export const publicSiteResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  themeId: z.string(),
  themeConfig: jsonObjectSchema,
  pages: z.array(publicPageSchema),
  posts: z.array(publicPostSchema),
});

export type PublicSiteResponse = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  themeId: string;
  themeConfig: JsonObject;
  pages: PublicPage[];
  posts: PublicPost[];
};
