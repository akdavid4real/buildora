import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    role: z.enum(['USER', 'ADMIN']),
    createdAt: z.coerce.date(),
  }),
  accessToken: z.string(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
