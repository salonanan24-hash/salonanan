import { analyticsAllowed } from '@/stores/cookie-consent-store';

const storageKey = 'anan-analytics';

type AnalyticsState = {
  views: Array<{ path: string; at: number }>;
};

function read(): AnalyticsState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { views: [] };
    const parsed = JSON.parse(raw) as AnalyticsState;
    return Array.isArray(parsed.views) ? { views: parsed.views.slice(-200) } : { views: [] };
  } catch {
    return { views: [] };
  }
}

/** First-party page-view log — only when the visitor allowed analytics cookies. */
export function trackPageView(path: string) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const next = read();
  next.views.push({ path, at: Date.now() });
  try {
    localStorage.setItem(storageKey, JSON.stringify({ views: next.views.slice(-200) }));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearAnalyticsStorage() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
