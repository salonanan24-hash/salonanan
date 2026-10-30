import { Router } from 'express';
import { z } from 'zod';
import { requestPasswordCode, resetPasswordWithToken, verifyPasswordCode } from '../auth/password-reset.js';
import { wrap } from '../admin/wrap.js';
import { sendWelcome } from '../mail/letters.js';

export const accountRouter = Router();

const emailSchema = z.string().trim().email().max(160);
const localeSchema = z.enum(['he', 'ar']).default('he');

accountRouter.post(
  '/welcome',
  wrap(async (req, res) => {
    const email = emailSchema.parse(req.body?.email);
    await sendWelcome(email);
    res.json({ ok: true });
  }),
);

accountRouter.post(
  '/password-code',
  wrap(async (req, res) => {
    const body = z.object({ email: emailSchema, locale: localeSchema }).parse(req.body);
    await requestPasswordCode(body.email, body.locale);
    res.json({ ok: true });
  }),
);

accountRouter.post(
  '/password-code/verify',
  wrap(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        code: z.string().trim().regex(/^\d{6}$/),
      })
      .parse(req.body);
    const token = await verifyPasswordCode(body.email, body.code);
    res.json({ token });
  }),
);

accountRouter.post(
  '/password-reset',
  wrap(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        token: z.string().trim().min(32).max(200),
        password: z.string().min(8).max(200),
      })
      .parse(req.body);
    await resetPasswordWithToken(body.email, body.token, body.password);
    res.json({ ok: true });
  }),
);
