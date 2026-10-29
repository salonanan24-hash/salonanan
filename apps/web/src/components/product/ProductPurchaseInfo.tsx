import { Info, Store, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';

export function ProductPurchaseInfo() {
  const { messages } = useI18n();

  return (
    <div className="mt-6 space-y-6">
      <section>
        <h2 className="text-sm font-bold text-ink">{messages.product.fulfillmentTitle}</h2>
        <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#3c4a62]">
          <li className="inline-flex items-center gap-2">
            <Store className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            {messages.product.pickup}
            <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </li>
          <li className="inline-flex items-center gap-2">
            <Truck className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            {messages.product.homeDelivery}
            <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </li>
        </ul>
      </section>
      <section className="border-t border-line pt-5">
        <h2 className="text-base font-extrabold text-ink">{messages.product.paymentsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{messages.product.paymentsVia}</p>
        <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label={messages.product.paymentsTitle}>
          <li>
            <VisaMark />
          </li>
          <li>
            <MastercardMark />
          </li>
          <li>
            <GooglePayMark />
          </li>
          <li>
            <ApplePayMark />
          </li>
        </ul>
      </section>
    </div>
  );
}

function VisaMark() {
  return (
    <span className="inline-flex h-8 w-12 items-center justify-center rounded-md bg-[#1a1f71]" aria-hidden="true">
      <span className="text-[11px] font-black italic tracking-wide text-white">VISA</span>
    </span>
  );
}

function MastercardMark() {
  return (
    <span className="inline-flex h-8 w-12 items-center justify-center" aria-hidden="true">
      <span className="relative h-6 w-9">
        <span className="absolute start-0 top-0 h-6 w-6 rounded-full bg-[#eb001b]" />
        <span className="absolute end-0 top-0 h-6 w-6 rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    </span>
  );
}

function GooglePayMark() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l6.3 5.3C37.4 38.2 44 33 44 24c0-1.3-.1-2.7-.4-3.5z"
        />
      </svg>
    </span>
  );
}

function ApplePayMark() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
        />
      </svg>
    </span>
  );
}
