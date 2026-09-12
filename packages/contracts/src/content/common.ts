import { z } from 'zod';

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export const contentSlugSchema = z
  .string({ required_error: 'Slug is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Slug cannot be empty')
  .max(100, 'Slug must not exceed 100 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug may only contain lowercase letters, numbers, and hyphens (no leading/trailing/consecutive hyphens)',
  );

/**
 * Recursively JSON-safe primitive, object, and array schemas.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [Key in string]?: JsonValue };
export type JsonArray = JsonValue[];

export const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

/**
 * Recursive Tiptap mark schema with strict JSON-safe attributes.
 */
export type TiptapMark = {
  type: string;
  attrs?: JsonObject;
};

export const tiptapMarkSchema: z.ZodType<TiptapMark> = z.object({
  type: z.string().min(1, 'Mark type is required'),
  attrs: jsonObjectSchema.optional(),
});

/**
 * Recursive Tiptap node schema for inline/block child nodes and marks with JSON-safe attributes.
 */
export type TiptapNode = {
  type: string;
  attrs?: JsonObject;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export const tiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.string().min(1, 'Node type is required'),
    attrs: jsonObjectSchema.optional(),
    content: z.array(tiptapNodeSchema).optional(),
    marks: z.array(tiptapMarkSchema).optional(),
    text: z.string().optional(),
  }),
);

/**
 * Canonical Tiptap root document schema: requires `{ type: 'doc', content: [...] }`.
 * Arbitrary non-JSON properties or passthrough top-level keys are disallowed/stripped.
 */
export const tiptapDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(tiptapNodeSchema).default([]),
});

export type TiptapDoc = z.infer<typeof tiptapDocSchema>;

export const EMPTY_TIPTAP_DOC: TiptapDoc = {
  type: 'doc',
  content: [],
};

export const seoMetadataSchema = z.object({
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
export type SeoMetadata = z.infer<typeof seoMetadataSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginatedMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type PaginatedMeta = z.infer<typeof paginatedMetaSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}
