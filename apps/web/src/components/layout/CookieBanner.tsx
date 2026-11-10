import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clearAnalyticsStorage, trackPageView } from '@/lib/site-analytics';
import { useI18n } from '@/i18n';
import { useCookieConsentStore } from '@/stores/cookie-consent-store';

export function CookieBanner() {
  const { messages } = useI18n();
  const { pathname } = useLocation();
  const copy = messages.cookies;
  const decided = useCookieConsentStore((state) => state.decided);
  const open = useCookieConsentStore((state) => state.open);
  const preferences = useCookieConsentStore((state) => state.preferences);
  const acceptAll = useCookieConsentStore((state) => state.acceptAll);
  const rejectOptional = useCookieConsentStore((state) => state.rejectOptional);
  const savePreferences = useCookieConsentStore((state) => state.savePreferences);
  const closeSettings = useCookieConsentStore((state) => state.closeSettings);
  const [functional, setFunctional] = useState(preferences.functional);
  const [analytics, setAnalytics] = useState(preferences.analytics);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (useCookieConsentStore.persist.hasHydrated()) {
      useCookieConsentStore.setState({ hydrated: true });
      setReady(true);
      return;
    }
    return useCookieConsentStore.persist.onFinishHydration(() => {
      useCookieConsentStore.setState({ hydrated: true });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    setFunctional(preferences.functional);
    setAnalytics(preferences.analytics);
  }, [preferences.analytics, preferences.functional, open]);

  useEffect(() => {
    if (!ready || !decided) return;
    if (preferences.analytics) trackPageView(pathname);
    else clearAnalyticsStorage();
  }, [decided, pathname, preferences.analytics, ready]);

  if (!ready || (decided && !open)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white p-4 shadow-[0_-12px_40px_rgb(23_32_51/0.16)] sm:p-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="space-y-2">
          <h2 className="text-base font-extrabold text-ink">{copy.title}</h2>
          <p className="text-sm leading-6 text-muted">
            {copy.body}{' '}
            <Link to="/cookies" className="font-semibold text-brand-blue underline">
              {copy.policy}
            </Link>
            .
          </p>
        </div>

        {open ? (
          <div className="grid gap-3 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-3">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                <span className="block font-bold">{copy.necessary}</span>
                <span className="text-muted">{copy.necessaryHint}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={functional}
                onChange={(event) => setFunctional(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-bold">{copy.functional}</span>
                <span className="text-muted">{copy.functionalHint}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-bold">{copy.analytics}</span>
                <span className="text-muted">{copy.analyticsHint}</span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {open ? (
            <>
              <button
                type="button"
                onClick={closeSettings}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink"
              >
                {copy.close}
              </button>
              <button
                type="button"
                onClick={() => savePreferences({ functional, analytics })}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand-blue px-5 text-sm font-bold text-white"
              >
                {copy.save}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => useCookieConsentStore.getState().openSettings()}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink"
              >
                {copy.settings}
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink"
              >
                {copy.reject}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand-blue px-5 text-sm font-bold text-white"
              >
                {copy.accept}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
