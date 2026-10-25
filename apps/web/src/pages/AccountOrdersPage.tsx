import { formatMoney, ils } from '@anan/shared';
import { Plus, X } from 'lucide-react';
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
      <h1 className="text-3xl font-extrabold text-ink">{copy.ordersTitle}</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#ececec] bg-white">
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
          <ul>
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

  return (
    <li className="border-t border-[#ececec]">
      <div className="grid items-center gap-3 px-4 py-4 text-center sm:grid-cols-[11rem_6rem_7rem_minmax(0,1fr)_12rem]">
        <p className="text-sm text-ink sm:text-center">{formatOrderDate(order.placedAt, locale)}</p>
        <p className="text-sm text-ink">{order.number}</p>
        <p className="text-sm font-bold text-ink">{formatMoney(ils(order.totalMinor), locale)}</p>
        <p className="text-sm text-ink">{statusLabel(order.status, copy)}</p>
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
      {open ? (
        <div className="space-y-4 border-t border-[#f0f0f0] bg-white px-4 py-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4">
              {item.image ? (
                <img src={item.image} alt="" className="size-16 shrink-0 object-contain" />
              ) : (
                <span className="size-16 shrink-0 rounded-lg bg-[#f6f6f6]" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-ink">{item.name[locale]}</p>
                <p className="mt-1 text-sm text-muted">{fill(copy.quantity, { count: item.quantity })}</p>
              </div>
              <div className="ms-auto text-end">
                <p className="text-sm text-muted">{copy.status}</p>
                <p className="font-bold text-ink">{statusLabel(order.status, copy)}</p>
                <p className="mt-3 text-sm text-muted">{copy.lineTotal}</p>
                <p className="font-bold text-ink">{formatMoney(ils(item.lineTotalMinor), locale)}</p>
                {order.note ? (
                  <>
                    <p className="mt-3 text-sm text-muted">{messages.desk.orders.note}</p>
                    <p className="font-semibold text-ink">{order.note}</p>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}
