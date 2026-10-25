import type { NextFunction, Request, Response } from 'express';
import { isAdminEmail } from '@anan/shared';
import { AppError } from '../errors/app-error.js';
import { isSupabaseConfigured, getSupabaseAdmin } from '../lib/supabase.js';

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isSupabaseConfigured()) {
    throw new AppError(503, 'not_configured', 'Database is not configured');
  }

  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AppError(401, 'unauthorized', 'Sign in required');

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !isAdminEmail(data.user?.email)) {
    throw new AppError(403, 'forbidden', 'Admin only');
  }

  next();
}
