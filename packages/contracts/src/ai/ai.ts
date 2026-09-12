import { z } from 'zod';

export const AI_ACTION_TYPES = [
  'TITLE',
  'OUTLINE',
  'DRAFT',
  'REWRITE',
  'SHORTEN',
  'EXPAND',
  'EXCERPT',
  'SEO_METADATA',
] as const;

export type AiActionType = (typeof AI_ACTION_TYPES)[number];
export const aiActionTypeSchema = z.enum(AI_ACTION_TYPES);

export const generateAiContentSchema = z.object({
  actionType: aiActionTypeSchema,
  context: z
    .string({ required_error: 'Context text is required' })
    .trim()
    .min(1, 'Context cannot be empty')
    .max(10000, 'Context must not exceed 10,000 characters'),
  instructions: z
    .string()
    .trim()
    .max(1000, 'Instructions must not exceed 1,000 characters')
    .optional(),
  targetEntity: z.enum(['PAGE', 'POST', 'SITE']).optional(),
});

export type GenerateAiContentDto = z.infer<typeof generateAiContentSchema>;

export const generateAiContentResponseSchema = z.object({
  actionType: aiActionTypeSchema,
  suggestion: z.string(),
  model: z.string(),
  tokensUsed: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
});

export type GenerateAiContentResponse = z.infer<typeof generateAiContentResponseSchema>;

export const aiGenerationLogResponseSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  userId: z.string().uuid(),
  actionType: aiActionTypeSchema,
  model: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().nullable(),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
});

export type AiGenerationLogResponse = z.infer<typeof aiGenerationLogResponseSchema>;

export const aiLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actionType: aiActionTypeSchema.optional(),
});

export type AiLogListQuery = z.infer<typeof aiLogListQuerySchema>;
