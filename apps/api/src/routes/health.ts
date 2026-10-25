import { Router } from 'express';
import { healthResponseSchema } from '@anan/shared';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { parseWithSchema } from '../validation/parse.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body = parseWithSchema(
    healthResponseSchema,
    {
      status: 'ok',
      service: 'anan-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      supabase: isSupabaseConfigured() ? 'configured' : 'not_configured',
    },
    'health response',
  );

  res.json(body);
});
