import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

export type ToastKind = 'register' | 'login' | 'cartAdded' | 'cartMax';

type ToastItem = { id: number; kind: ToastKind };

const welcomeKey = 'anan-register-welcome';
let toastId = 0;

export function markRegisterWelcome() {
  sessionStorage.setItem(welcomeKey, '1');
  pushToast('register');
}

export function registerWelcomePending() {
  return sessionStorage.getItem(welcomeKey) === '1';
}

export function pushToast(kind: ToastKind) {
  window.dispatchEvent(new CustomEvent<ToastKind>('anan-toast', { detail: kind }));
}

export function ActionToast() {
  const { messages } = useI18n();
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    function onToast(event: Event) {
      const kind = (event as CustomEvent<ToastKind>).detail;
      setToast({ id: ++toastId, kind });
    }
    window.addEventListener('anan-toast', onToast);
    return () => window.removeEventListener('anan-toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
      if (toast.kind === 'register') sessionStorage.removeItem(welcomeKey);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const text =
    toast.kind === 'register'
      ? messages.auth.welcome
      : toast.kind === 'login'
        ? messages.auth.loginDone
        : toast.kind === 'cartAdded'
          ? messages.cart.added
          : messages.cart.maxQuantity;
  const warning = toast.kind === 'cartMax';

  return (
    <div className="pointer-events-none fixed bottom-6 start-6 z-[70] w-[min(22rem,calc(100%-2rem))]">
      <div
        key={toast.id}
        role="status"
        className="anan-rise flex items-center gap-3 rounded-2xl border border-[#eceff3] bg-white px-4 py-3.5 shadow-[0_16px_40px_rgb(23_32_51/0.16)]"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
          {warning ? '!' : <Check className="h-4 w-4" aria-hidden="true" />}
        </span>
        <p className="text-sm leading-5 text-ink">{text}</p>
      </div>
    </div>
  );
}
