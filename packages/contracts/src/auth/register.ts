import { z } from 'zod';

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const registerResponseSchema = z.object({
  user: userResponseSchema,
  accessToken: z.string(),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;
