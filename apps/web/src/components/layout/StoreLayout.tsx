import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { directionFor } from '@anan/shared';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { useI18n } from '@/i18n';
import { ActionToast } from '@/components/ui/ActionToast';
import { CategoryNav } from './CategoryNav';
import { Footer } from './Footer';
import { Header } from './Header';

export function StoreLayout() {
  const { locale, messages } = useI18n();
  const { pathname } = useLocation();
  const catalog = useDevelopmentCatalog();
  const accountPage = pathname === '/account' || pathname.startsWith('/account/');
  const compact = useCompactHeader(pathname);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
  }, [locale]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (catalog.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-muted">
        {messages.common.loading}
      </div>
    );
  }

  if (catalog.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-ink">{messages.common.loadError}</p>
        <button
          type="button"
          onClick={() => void catalog.refetch()}
          className="inline-flex h-11 items-center rounded-full bg-brand-blue px-5 text-sm font-bold text-white"
        >
          {messages.common.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2"
      >
        {messages.skip}
      </a>
      <ActionToast />
      <div
        data-store-header
        className={`sticky top-0 z-40 bg-white ${compact ? 'shadow-[0_8px_24px_rgb(23_32_51/0.08)]' : ''}`}
      >
        <div className="h-1 bg-brand-red" />
        <Header />
        {accountPage ? null : (
          <div className={`grid transition-[grid-template-rows] duration-300 ${compact ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
            <div className="overflow-hidden">
              <CategoryNav />
            </div>
          </div>
        )}
      </div>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function useCompactHeader(pathname: string) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(false);
    let last = window.scrollY;
    let frame = 0;
    let acc = 0;
    let current = false;
    let lockUntil = 0;

    function commit(next: boolean) {
      if (next === current) return;
      current = next;
      setCompact(next);
      acc = 0;
      lockUntil = performance.now() + 450;
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (performance.now() < lockUntil) {
          last = y;
          return;
        }
        const delta = y - last;
        last = y;
        if (y < 72) {
          acc = 0;
          commit(false);
          return;
        }
        acc = Math.sign(delta) === Math.sign(acc) || acc === 0 ? acc + delta : delta;
        if (acc > 18) commit(true);
        else if (acc < -18) commit(false);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  return compact;
}
