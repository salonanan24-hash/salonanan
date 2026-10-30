import { apiBase } from '@/lib/api-url';

const storageKey = 'anan-password-reset';

export type PasswordResetGrant = {
  email: string;
  token: string;
};

export function savePasswordReset(grant: PasswordResetGrant) {
  sessionStorage.setItem(storageKey, JSON.stringify(grant));
}

export function readPasswordReset(): PasswordResetGrant | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PasswordResetGrant>;
    if (!parsed.email || !parsed.token) return null;
    return { email: parsed.email, token: parsed.token };
  } catch {
    return null;
  }
}

export function clearPasswordReset() {
  sessionStorage.removeItem(storageKey);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase()}/api/account/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as { error?: { code?: string }; token?: string } | null;
  if (!response.ok) throw new Error(payload?.error?.code ?? 'failed');
  return payload as T;
}

export function requestPasswordCode(email: string, locale: 'he' | 'ar') {
  return post<{ ok: true }>('password-code', { email, locale });
}

export function verifyPasswordCode(email: string, code: string) {
  return post<{ token: string }>('password-code/verify', { email, code });
}

export function resetPassword(email: string, token: string, password: string) {
  return post<{ ok: true }>('password-reset', { email, token, password });
}
