/** Base URL for the store API. Empty means the current site, so production calls `/api/...` on Vercel. */
export function apiBase(): string {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  if (import.meta.env.PROD && (configured.length === 0 || local)) return '';
  return configured || 'http://localhost:4000';
}
