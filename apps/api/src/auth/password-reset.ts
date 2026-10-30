import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';
import { sendPasswordCodeMail, type MailLocale } from '../mail/letters.js';

const CODE_MS = 5 * 60 * 1000;
const TOKEN_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;
const RESEND_GAP_MS = 20 * 1000;

type Meta = Record<string, unknown>;

function hash(value: string): string {
  return createHmac('sha256', config.supabaseServiceRoleKey).update(value).digest('hex');
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function passwordIsStrong(password: string): boolean {
  return password.length >= 8 && password.length <= 200 && /\p{Lu}/u.test(password) && /\d/.test(password);
}

async function findUser(email: string) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const result = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new AppError(500, 'database', 'Database write failed');
    const found = result.data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (result.data.users.length < 200) return null;
  }
  return null;
}

async function saveMeta(id: string, meta: Meta) {
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(id, { user_metadata: meta });
  if (updated.error) throw new AppError(500, 'database', 'Database write failed');
}

export async function requestPasswordCode(email: string, locale: MailLocale): Promise<void> {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  const user = await findUser(email);
  if (!user?.email) return;
  const meta = { ...(user.user_metadata ?? {}) } as Meta;
  const sentAt = Number(meta.reset_code_sent_at ?? 0);
  const expires = Number(meta.reset_code_exp ?? 0);
  if (sentAt && Date.now() - sentAt < RESEND_GAP_MS && expires > Date.now()) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const next: Meta = {
    ...meta,
    reset_code_hash: hash(`${user.email.toLowerCase()}:${code}`),
    reset_code_exp: Date.now() + CODE_MS,
    reset_code_tries: 0,
    reset_code_sent_at: Date.now(),
    reset_token_hash: '',
    reset_token_exp: 0,
  };
  await saveMeta(user.id, next);
  const sent = await sendPasswordCodeMail(user.email, code, locale);
  if (!sent) {
    await saveMeta(user.id, { ...next, reset_code_hash: '', reset_code_exp: 0 });
    throw new AppError(502, 'mail', 'Mail was not sent');
  }
}

export async function verifyPasswordCode(email: string, code: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  const user = await findUser(email);
  if (!user?.email) throw new AppError(400, 'invalid_code', 'Code is invalid');
  const meta = { ...(user.user_metadata ?? {}) } as Meta;
  const tries = Number(meta.reset_code_tries ?? 0);
  const expires = Number(meta.reset_code_exp ?? 0);
  const stored = typeof meta.reset_code_hash === 'string' ? meta.reset_code_hash : '';
  if (!stored || !Number.isFinite(expires) || expires < Date.now() || tries >= MAX_TRIES) {
    throw new AppError(400, 'invalid_code', 'Code is invalid');
  }
  const matches = same(stored, hash(`${user.email.toLowerCase()}:${code}`));
  if (!matches) {
    await saveMeta(user.id, { ...meta, reset_code_tries: tries + 1 });
    throw new AppError(400, 'invalid_code', 'Code is invalid');
  }
  const token = randomBytes(32).toString('hex');
  await saveMeta(user.id, {
    ...meta,
    reset_code_hash: '',
    reset_code_exp: 0,
    reset_code_tries: 0,
    reset_token_hash: hash(`${user.email.toLowerCase()}:${token}`),
    reset_token_exp: Date.now() + TOKEN_MS,
  });
  logger.info('password code accepted');
  return token;
}

export async function resetPasswordWithToken(email: string, token: string, password: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  if (!passwordIsStrong(password)) throw new AppError(400, 'password', 'Password is too weak');
  const user = await findUser(email);
  if (!user?.email) throw new AppError(400, 'invalid_code', 'Code is invalid');
  const meta = { ...(user.user_metadata ?? {}) } as Meta;
  const expires = Number(meta.reset_token_exp ?? 0);
  const stored = typeof meta.reset_token_hash === 'string' ? meta.reset_token_hash : '';
  if (!stored || !Number.isFinite(expires) || expires < Date.now()) {
    throw new AppError(400, 'invalid_code', 'Code is invalid');
  }
  if (!same(stored, hash(`${user.email.toLowerCase()}:${token}`))) {
    throw new AppError(400, 'invalid_code', 'Code is invalid');
  }
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...meta,
      reset_code_hash: '',
      reset_code_exp: 0,
      reset_code_tries: 0,
      reset_code_sent_at: 0,
      reset_token_hash: '',
      reset_token_exp: 0,
    },
  });
  if (updated.error) throw new AppError(500, 'database', 'Database write failed');
}
