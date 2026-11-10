import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';

const storageKey = 'anan-intro';

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function remember() {
  try {
    sessionStorage.setItem(storageKey, '1');
  } catch {
    /* Private browsing can block storage. Closing still works for this view. */
  }
}

export function WelcomeGate() {
  const { pathname } = useLocation();
  const { messages } = useI18n();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const holdRef = useRef(0);
  const doneRef = useRef(0);
  const overflowRef = useRef('');

  function finish() {
    window.clearTimeout(holdRef.current);
    window.clearTimeout(doneRef.current);
    document.body.style.overflow = overflowRef.current;
    remember();
    setVisible(false);
    setLeaving(false);
  }

  useEffect(() => {
    if (pathname !== '/' || dismissed()) return;
    setVisible(true);
    setLeaving(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    overflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    holdRef.current = window.setTimeout(() => setLeaving(true), reduce ? 200 : 2600);
    doneRef.current = window.setTimeout(() => {
      document.body.style.overflow = overflowRef.current;
      remember();
      setVisible(false);
      setLeaving(false);
    }, reduce ? 450 : 3250);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(holdRef.current);
      window.clearTimeout(doneRef.current);
      document.body.style.overflow = overflowRef.current;
      window.removeEventListener('keydown', onKey);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={messages.welcome.title}
      className={`anan-intro fixed inset-0 z-50 ${leaving ? 'is-leaving' : ''}`}
      onClick={finish}
    >
      <div className="anan-intro-ring" />
      <div className="anan-intro-ring" />
      <div className="anan-intro-ring" />
      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <img
          src="/brand/anan-logo.png"
          alt={messages.brand.logoAlt}
          width={2102}
          height={372}
          className="anan-intro-logo h-20 w-auto sm:h-24"
        />
        <p className="anan-intro-caption mt-6 text-sm font-semibold tracking-wide text-muted">{messages.welcome.body}</p>
        <div className="anan-intro-line" aria-hidden="true">
          <span />
        </div>
      </div>
      <p className="absolute bottom-6 start-6 text-[11px] font-semibold tracking-[0.22em] text-muted">{messages.welcome.skip}</p>
    </div>
  );
}
