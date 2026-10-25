import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('anan-api'),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  supabase: z.enum(['configured', 'not_configured']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
