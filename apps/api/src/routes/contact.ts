import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../admin/wrap.js';
import { AppError } from '../errors/app-error.js';
import { sendSiteInquiry } from '../mail/letters.js';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .refine((value) => (value.match(/\d/g) ?? []).length >= 7),
  message: z.string().trim().min(2).max(4000),
  locale: z.enum(['he', 'ar']).default('he'),
  website: z.string().max(200).optional().default(''),
});

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;
const recent = new Map<string, number[]>();

function limited(key: string): boolean {
  const now = Date.now();
  const stamps = (recent.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (stamps.length >= LIMIT) {
    recent.set(key, stamps);
    return true;
  }
  stamps.push(now);
  recent.set(key, stamps);
  if (recent.size > 500) {
    for (const [saved, times] of recent) {
      if (times.every((stamp) => now - stamp >= WINDOW_MS)) recent.delete(saved);
    }
  }
  return false;
}

export const contactRouter = Router();

contactRouter.post(
  '/',
  wrap(async (req, res) => {
    const input = contactSchema.parse(req.body);
    if (input.website.trim()) {
      res.json({ ok: true });
      return;
    }
    const ip = req.ip || 'unknown';
    if (limited(`${ip}:${input.email.toLowerCase()}`)) {
      throw new AppError(429, 'too_many', 'Too many messages');
    }
    const sent = await sendSiteInquiry(input);
    if (!sent) throw new AppError(503, 'mail_unavailable', 'Mail is not available');
    res.json({ ok: true });
  }),
);
