import { formatMoney, ils } from '@anan/shared';
import { CircleCheck, CircleHelp, Plus, ShoppingBag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { myOrders, type ApiOrder } from '@/orders/api';
import { fill, useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';

function formatOrderDate(value: string, locale: 'he' | 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-IL' : 'he-IL', {
    numberingSystem: 'latn',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function statusLabel(status: ApiOrder['status'], copy: ReturnType<typeof useI18n>['messages']['account']): string {
  if (status === 'completed') return copy.statusCompleted;
  if (status === 'cancelled') return copy.statusCancelled;
  if (status === 'placed') return copy.statusPlaced;
  if (status === 'ready') return copy.statusReady;
  if (status === 'shipping') return copy.statusShipping;
  return copy.statusProcessing;
}

function deliveryLabel(order: ApiOrder, copy: ReturnType<typeof useI18n>['messages']['account']): string {
  return order.deliveryMethod === 'home' ? copy.shippingHome : copy.shippingPickup;
}

export function AccountOrdersPage() {
  const { locale, messages } = useI18n();
  const copy = messages.account;
  const [openId, setOpenId] = useState<string | null>(null);
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(copy.orders);

  useEffect(() => {
    let active = true;
    myOrders()
      .then((list) => {
        if (active) setOrders(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink sm:text-3xl">
        <ShoppingBag className="size-5 sm:size-7" aria-hidden="true" />
        {copy.ordersTitle}
      </h1>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#ececec] bg-white sm:mt-6">
        <div className="hidden grid-cols-[11rem_6rem_7rem_minmax(0,1fr)_12rem] gap-3 bg-[#f6f6f6] px-4 py-3 text-center text-sm font-bold text-ink sm:grid">
          <span>{copy.date}</span>
          <span>{copy.orderNumber}</span>
          <span>{copy.amount}</span>
          <span>{copy.status}</span>
          <span>{copy.action}</span>
        </div>
        {failed ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{copy.loadFailed}</p>
        ) : orders === null ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{copy.loading}</p>
        ) : orders.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-bold text-ink">{copy.empty}</p>
            <p className="mt-2 text-sm text-muted">{copy.emptyHint}</p>
          </div>
        ) : (
          <ul className="space-y-3 p-3 sm:space-y-0 sm:p-0">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                open={openId === order.id}
                onToggle={() => setOpenId((current) => (current === order.id ? null : order.id))}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  open,
  onToggle,
  locale,
}: {
  order: ApiOrder;
  open: boolean;
  onToggle: () => void;
  locale: 'he' | 'ar';
}) {
  const { messages } = useI18n();
  const copy = messages.account;
  const status = statusLabel(order.status, copy);

  return (
    <li className="overflow-hidden rounded-2xl bg-[#f3f3f3] sm:rounded-none sm:border-t sm:border-[#ececec] sm:bg-white">
      <div className="hidden items-center gap-3 px-4 py-4 text-center sm:grid sm:grid-cols-[11rem_6rem_7rem_minmax(0,1fr)_12rem]">
        <p className="text-sm text-ink">{formatOrderDate(order.placedAt, locale)}</p>
        <p className="text-sm text-ink">{order.number}</p>
        <p className="text-sm font-bold text-ink">{formatMoney(ils(order.totalMinor), locale)}</p>
        <p className="text-sm text-ink">{status}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? copy.collapse : copy.expand}
            onClick={onToggle}
            className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-white"
          >
            {open ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          </button>
          <Link
            to={`/account/orders/${order.id}`}
            className="inline-flex h-9 items-center rounded-md bg-[#f5c518] px-3 text-xs font-bold text-ink"
          >
            {copy.showOrder}
          </Link>
        </div>
      </div>

      <div className="p-4 sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-extrabold text-ink">{fill(copy.orderNumberLine, { number: order.number })}</p>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? copy.collapse : copy.expand}
            onClick={onToggle}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-white"
          >
            {open ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">{formatOrderDate(order.placedAt, locale)}</p>
        <p className="mt-3 text-base font-extrabold text-ink">{formatMoney(ils(order.totalMinor), locale)}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{fill(copy.statusLine, { status })}</p>
          <Link
            to={`/account/orders/${order.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#f5c518] px-3 text-xs font-extrabold text-ink"
          >
            {copy.showOrder}
          </Link>
        </div>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-[#e8e8e8] bg-white px-4 py-4 sm:border-[#f0f0f0]">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#ececec] bg-white p-3 sm:border-0 sm:p-0">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt={item.name[locale]} className="size-16 shrink-0 rounded-lg object-contain sm:order-first" />
                ) : (
                  <span className="size-16 shrink-0 rounded-lg bg-[#f6f6f6]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{item.name[locale]}</p>
                  <p className="mt-1 text-sm text-muted">{fill(copy.quantity, { count: item.quantity })}</p>
                </div>
                <div className="ms-auto hidden text-end sm:block">
                  <p className="text-sm text-muted">{copy.status}</p>
                  <p className="font-bold text-ink">{status}</p>
                  <p className="mt-3 text-sm text-muted">{copy.lineTotal}</p>
                  <p className="font-bold text-ink">{formatMoney(ils(item.lineTotalMinor), locale)}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:hidden">
            <p className="text-muted">
              {copy.shipping}: <span className="font-semibold text-ink">{deliveryLabel(order, copy)}</span>
            </p>
            <p className="font-bold text-ink">
              {copy.lineTotal}: {formatMoney(ils(order.totalMinor), locale)}
            </p>
          </div>
          <div className="grid gap-2 sm:hidden">
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
              <CircleHelp className="size-4" aria-hidden="true" />
              {copy.createInquiry}
            </Link>
          </div>
          {order.note ? (
            <p className="hidden text-sm text-muted sm:block">
              {messages.desk.orders.note}: <span className="font-semibold text-ink">{order.note}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
