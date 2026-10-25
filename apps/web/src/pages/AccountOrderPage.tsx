import { formatMoney, ils } from '@anan/shared';
import { ShieldCheck, ShoppingBag, Wallet } from 'lucide-react';
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
          {copy.orders}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#ececec] bg-white px-5 py-5 shadow-[0_8px_24px_rgb(23_32_51/0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{fill(copy.orderHeading, { number: order.number })}</h1>
            <p className="mt-1 text-sm text-muted">{formatWhen(order.placedAt, locale)}</p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#e7f8ef] px-3 py-1 text-sm font-bold text-[#1c8a4a]">
            {statusLabel(order.status, copy)}
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-[#ececec] px-4 py-4">
            <span className="font-bold text-ink">{copy.trialPayment}</span>
            <Wallet className="size-5 text-brand-blue" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#f5c518] px-4 py-4">
            <span className="text-2xl font-extrabold text-ink">{formatMoney(ils(order.totalMinor), locale)}</span>
            <span className="text-sm font-bold text-ink">{copy.amount}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#ececec] bg-white px-5 py-5">
        <h2 className="flex items-center justify-end gap-2 text-lg font-extrabold text-ink">
          {copy.items}
          <ShoppingBag className="size-5" aria-hidden="true" />
        </h2>
        <ul className="mt-4 divide-y divide-[#f0f0f0]">
          {order.items.map((item) => (
            <li key={item.id} className="grid items-center gap-4 py-4 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_7rem]">
              {item.image ? (
                <img src={item.image} alt="" className="size-16 object-contain" />
              ) : (
                <span className="size-16 rounded-lg bg-[#f6f6f6]" />
              )}
              <div>
                <p className="font-bold text-ink">{item.name[locale]}</p>
                <p className="mt-1 text-sm text-muted">{fill(copy.quantity, { count: item.quantity })}</p>
              </div>
              <p className="text-sm font-bold text-ink">
                <span className="block text-xs font-medium text-muted">{copy.unitPrice}</span>
                {formatMoney(ils(item.unitPriceMinor), locale)}
              </p>
              <p className="text-sm font-bold text-ink">
                <span className="block text-xs font-medium text-muted">{copy.total}</span>
                {formatMoney(ils(item.lineTotalMinor), locale)}
              </p>
              <p className="text-sm text-ink">
                <span className="block text-xs text-muted">{copy.status}</span>
                {statusLabel(order.status, copy)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#ececec] bg-white px-5 py-5">
          <h2 className="text-lg font-extrabold text-ink">{copy.summary}</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-ink">{formatMoney(ils(item.lineTotalMinor), locale)}</span>
                <span className="truncate text-ink">{item.name[locale]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5c518] px-4 py-3 font-extrabold text-ink">
            <span>{formatMoney(ils(order.totalMinor), locale)}</span>
            <span>{copy.total}</span>
          </div>
        </section>
        <section className="rounded-2xl border border-[#d9f3e4] bg-[#f3fbf6] px-5 py-5">
          <h2 className="flex items-center justify-end gap-2 text-lg font-extrabold text-ink">
            {copy.payment}
            <ShieldCheck className="size-5 text-[#1c8a4a]" aria-hidden="true" />
          </h2>
          <p className="mt-4 flex items-center justify-between text-sm">
            <span className="font-bold text-ink">{copy.trialPayment}</span>
            <span className="text-muted">{copy.paymentMeans}</span>
          </p>
          {order.shippingAddress ? (
            <p className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-ink">{order.shippingAddress}</span>
              <span className="text-muted">{messages.checkout.shipping}</span>
            </p>
          ) : null}
          {order.note ? (
            <p className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-ink">{order.note}</span>
              <span className="text-muted">{messages.desk.orders.note}</span>
            </p>
          ) : null}
          {order.couponCode ? (
            <p className="mt-3 flex items-center justify-between text-sm">
              <span className="font-bold text-ink">{order.couponCode}</span>
              <span className="text-muted">{messages.desk.orders.coupon}</span>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
