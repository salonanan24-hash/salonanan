import { formatMoney, ils } from '@anan/shared';
import { Calculator, Check, ChevronLeft, CircleCheck, CreditCard, Mail, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { myOrder, type ApiOrder } from '@/orders/api';
import { fill, useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';

function statusLabel(status: ApiOrder['status'], copy: ReturnType<typeof useI18n>['messages']['account']): string {
  if (status === 'completed') return copy.statusCompleted;
  if (status === 'cancelled') return copy.statusCancelled;
  if (status === 'placed') return copy.statusPlaced;
  if (status === 'ready') return copy.statusReady;
  if (status === 'shipping') return copy.statusShipping;
  return copy.statusProcessing;
}

function formatWhen(value: string, locale: 'he' | 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-IL' : 'he-IL', {
    numberingSystem: 'latn',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function AccountOrderPage() {
  const { orderId = '' } = useParams();
  const { locale, messages } = useI18n();
  const copy = messages.account;
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(order ? fill(copy.orderHeading, { number: order.number }) : copy.orders);

  useEffect(() => {
    let active = true;
    myOrder(orderId)
      .then((next) => {
        if (active) setOrder(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  if (!failed && !order) return <p className="text-sm text-muted">{copy.loading}</p>;

  if (!order) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-ink">{copy.notFound}</h1>
        <Link to="/account/orders" className="mt-6 inline-block text-sm font-bold text-brand-blue">
          {copy.backToOrders}
        </Link>
      </div>
    );
  }

  const status = statusLabel(order.status, copy);

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm font-bold text-ink">
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {copy.backToOrders}
      </Link>

      <section className="rounded-2xl border border-[#ececec] bg-white px-4 py-5 shadow-[0_8px_24px_rgb(23_32_51/0.04)] sm:px-5">
        <div className="text-center sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 sm:text-start">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{fill(copy.orderHeading, { number: order.number })}</h1>
            <p className="mt-1 text-sm text-muted">{formatWhen(order.placedAt, locale)}</p>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e7f8ef] px-3 py-1.5 text-sm font-bold text-[#1c8a4a] sm:mt-0">
            <Check className="size-4" aria-hidden="true" />
            {status}
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-[#ececec] px-4 py-4">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#e8f1ff] text-brand-blue">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <span className="font-bold text-ink">{copy.paymentCash}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#f5c518] px-4 py-4">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-white/70 text-lg font-extrabold text-ink">
              ₪
            </span>
            <div>
              <p className="text-xs font-bold text-ink/70">{copy.amount}</p>
              <p className="text-2xl font-extrabold text-ink">{formatMoney(ils(order.totalMinor), locale)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#ececec] bg-white">
        <h2 className="flex items-center gap-2 border-b border-[#ececec] bg-[#f7f7f7] px-4 py-3 text-base font-extrabold text-ink sm:px-5 sm:text-lg">
          <ShoppingBag className="size-5" aria-hidden="true" />
          {copy.items}
        </h2>
        <ul className="divide-y divide-[#f0f0f0] px-4 sm:px-5">
          {order.items.map((item) => (
            <li key={item.id} className="py-4">
              <div className="sm:grid sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_7rem] sm:items-center sm:gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name[locale]}
                    className="mb-3 size-24 rounded-xl border border-[#ececec] bg-[#fafafa] object-contain p-2 sm:mb-0 sm:size-16 sm:border-0 sm:bg-transparent sm:p-0"
                  />
                ) : (
                  <span className="mb-3 block size-24 rounded-xl bg-[#f6f6f6] sm:mb-0 sm:size-16" />
                )}
                <p className="mb-3 font-bold text-ink sm:mb-0">{item.name[locale]}</p>
                <dl className="space-y-2.5 text-sm sm:contents">
                  <div className="flex items-center justify-between gap-3 sm:block">
                    <dt className="text-muted sm:mb-1 sm:text-xs sm:font-medium">{copy.qty}</dt>
                    <dd className="font-bold text-ink">{item.quantity}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block">
                    <dt className="text-muted sm:mb-1 sm:text-xs sm:font-medium">{copy.unitPrice}</dt>
                    <dd className="font-bold text-ink">{formatMoney(ils(item.unitPriceMinor), locale)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block">
                    <dt className="text-muted sm:mb-1 sm:text-xs sm:font-medium">{copy.total}</dt>
                    <dd className="font-bold text-ink">{formatMoney(ils(item.lineTotalMinor), locale)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:hidden">
                    <dt className="text-muted">{copy.status}</dt>
                    <dd className="font-bold text-ink">{status}</dd>
                  </div>
                </dl>
                <p className="hidden text-sm text-ink sm:block">
                  <span className="mb-1 block text-xs text-muted">{copy.status}</span>
                  {status}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t border-[#f0f0f0] px-4 py-4 sm:hidden">
          {order.status === 'completed' ? (
            <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#f5c518] bg-white text-sm font-bold text-ink">
              <CircleCheck className="size-4 text-[#1c8a4a]" aria-hidden="true" />
              {copy.deliveredToCustomer}
            </span>
          ) : null}
          <Link
            to="/contact"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white text-sm font-bold text-ink"
          >
            <Mail className="size-4" aria-hidden="true" />
            {copy.contactUs}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9f3e4] bg-[#f3fbf6] px-4 py-5 sm:px-5">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink sm:text-lg">
          <ShieldCheck className="size-5 text-[#1c8a4a]" aria-hidden="true" />
          {copy.payment}
        </h2>
        <div className="mt-4 rounded-xl border border-[#d9f3e4] bg-white px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">{copy.paymentMeans}</span>
            <span className="font-bold text-ink">{copy.paymentCash}</span>
          </div>
          {order.shippingAddress ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0f0f0] pt-3">
              <span className="text-muted">{messages.checkout.shipping}</span>
              <span className="text-end font-bold text-ink">{order.shippingAddress}</span>
            </div>
          ) : null}
          {order.note ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0f0f0] pt-3">
              <span className="text-muted">{messages.desk.orders.note}</span>
              <span className="text-end font-bold text-ink">{order.note}</span>
            </div>
          ) : null}
          {order.couponCode ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0f0f0] pt-3">
              <span className="text-muted">{messages.desk.orders.coupon}</span>
              <span className="font-bold text-ink">{order.couponCode}</span>
            </div>
          ) : null}
        </div>
        <Link to="/contact" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-blue">
          <Mail className="size-4" aria-hidden="true" />
          {copy.orderQuestions}
        </Link>
      </section>

      <section className="rounded-2xl border border-[#ececec] bg-white px-4 py-5 sm:px-5">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink sm:text-lg">
          <Calculator className="size-5" aria-hidden="true" />
          {copy.summary}
        </h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-ink">{item.name[locale]}</span>
              <span className="shrink-0 font-bold text-ink">{formatMoney(ils(item.lineTotalMinor), locale)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5c518] px-4 py-3 font-extrabold text-ink">
          <span>{copy.total}</span>
          <span>{formatMoney(ils(order.totalMinor), locale)}</span>
        </div>
      </section>
    </div>
  );
}
