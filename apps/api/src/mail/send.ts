import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export function mailFrom(displayName: string): string {
  const raw = config.resendFrom;
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] ?? raw).trim();
  return `${displayName} <${email}>`;
}

export async function sendMail(input: { to: string; subject: string; html: string; fromName: string }): Promise<boolean> {
  if (!config.resendApiKey) {
    logger.warn('mail skipped, RESEND_API_KEY is empty');
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom(input.fromName),
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error('mail failed', { status: response.status, body: body.slice(0, 400) });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('mail failed', { message: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}
