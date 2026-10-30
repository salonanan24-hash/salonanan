import { z } from 'zod';
import { logger } from './lib/logger.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('onboarding@resend.dev'),
});

function readUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      logger.warn('ignoring SUPABASE_URL with an unsupported protocol');
      return '';
    }
    return trimmed;
  } catch {
    logger.warn('ignoring invalid SUPABASE_URL');
    return '';
  }
}

const parsed = envSchema.parse({
  PORT: process.env.PORT ?? '4000',
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
});

export const config = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  corsOrigins: parsed.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  supabaseUrl: readUrl(parsed.SUPABASE_URL),
  supabaseAnonKey: parsed.SUPABASE_ANON_KEY.trim(),
  supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY.trim(),
  openaiApiKey: parsed.OPENAI_API_KEY.trim(),
  openaiModel: parsed.OPENAI_MODEL.trim() || 'gpt-4o-mini',
  openaiBaseUrl: httpBase(parsed.OPENAI_BASE_URL),
  resendApiKey: parsed.RESEND_API_KEY.trim(),
  resendFrom: parsed.RESEND_FROM.trim() || 'onboarding@resend.dev',
};

function httpBase(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return 'https://api.openai.com/v1';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'https://api.openai.com/v1';
    return trimmed;
  } catch {
    return 'https://api.openai.com/v1';
  }
}

function isVercelOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/** Local Vite may move from 5173 to the next free port. Allow those only outside production. */
export function isCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  if (isVercelOrigin(origin)) return true;
  if (config.nodeEnv === 'production') return false;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}
