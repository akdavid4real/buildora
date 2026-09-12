import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
    WEB_URL: z.string().url('WEB_URL must be a valid URL').default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
    MISTRAL_API_KEY: z.string().optional(),
    MISTRAL_MODEL: z.string().default('mistral-small-latest'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_URL_BASE: z.string().optional(),
    S3_FORCE_PATH_STYLE: z
      .preprocess((val) => {
        if (val === undefined || val === '') return true;
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          if (lower === 'true' || lower === '1') return true;
          if (lower === 'false' || lower === '0') return false;
        }
        return val;
      }, z.boolean())
      .default(true),
  })
  .superRefine((data, ctx) => {
    const s3Keys = [data.S3_BUCKET, data.S3_ACCESS_KEY_ID, data.S3_SECRET_ACCESS_KEY];
    const definedCount = s3Keys.filter((v) => typeof v === 'string' && v.trim().length > 0).length;

    if (definedCount > 0 && definedCount < s3Keys.length) {
      if (!data.S3_BUCKET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'S3_BUCKET is required when configuring S3 storage',
          path: ['S3_BUCKET'],
        });
      }
      if (!data.S3_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'S3_ACCESS_KEY_ID is required when configuring S3 storage',
          path: ['S3_ACCESS_KEY_ID'],
        });
      }
      if (!data.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'S3_SECRET_ACCESS_KEY is required when configuring S3 storage',
          path: ['S3_SECRET_ACCESS_KEY'],
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`\n[Buildora API] Environment validation failed:\n${errors}\n`);
  }
  return result.data;
}
