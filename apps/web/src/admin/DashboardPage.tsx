import { formatMoney, ils } from '@anan/shared';
import { BarChart3, FolderTree, Package, Settings, ShoppingCart, Tags, Ticket, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminRequest } from '@/admin/remote';
import { useAdminStore } from '@/admin/store';
import { useAdminOrders, useRegisteredCustomers } from '@/admin/use-orders';
import { PageHeader, Panel, PrimaryButton, SearchBox, SelectInput } from '@/admin/ui';
import { useI18n } from '@/i18n';
import type { ApiOrder } from '@/orders/api';

const shortcuts = [
  { to: '/admin/products', key: 'products', icon: Package },
  { to: '/admin/categories', key: 'categories', icon: FolderTree },
  { to: '/admin/brands', key: 'brands', icon: Tags },
  { to: '/admin/orders', key: 'orders', icon: ShoppingCart },
  { to: '/admin/customers', key: 'customers', icon: Users },
  { to: '/admin/coupons', key: 'coupons', icon: Ticket },
  { to: '/admin/reports', key: 'reports', icon: BarChart3 },
  { to: '/admin/settings', key: 'settings', icon: Settings },
] as const;

function activeThisMonth(order: ApiOrder, now = new Date()) {
  if (order.status === 'cancelled') return false;
  const placed = new Date(order.placedAt);
  return placed.getFullYear() === now.getFullYear() && placed.getMonth() === now.getMonth();
}

export function DashboardPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.dashboard;
  const products = useAdminStore((state) => state.products);
  const { orders } = useAdminOrders();
  const registered = useRegisteredCustomers();
  const monthOrders = (orders ?? []).filter((order) => activeThisMonth(order));
  const monthRevenue = monthOrders.reduce((sum, order) => sum + order.totalMinor, 0);

  const cards = [
    { label: copy.monthRevenue, value: orders ? formatMoney(ils(monthRevenue), locale) : '…', hint: copy.monthHint },
    { label: copy.monthOrders, value: orders ? String(monthOrders.length) : '…', hint: copy.monthHint },
    { label: copy.products, value: String(products.length), hint: '' },
    { label: copy.registered, value: registered === null ? '…' : String(registered), hint: '' },
  ];

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Panel key={card.label}>
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-3 text-5xl font-extrabold tabular-nums">{card.value}</p>
            {card.hint ? <p className="mt-2 text-xs leading-5 text-muted">{card.hint}</p> : null}
          </Panel>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-sm font-bold text-muted">{copy.recent}</h2>
      <Panel className="divide-y divide-line p-0">
        {products.slice(0, 6).map((product) => (
          <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="truncate font-semibold">{product.name[locale]}</p>
            <p className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(ils(product.priceMinor), locale)}</p>
          </div>
        ))}
      </Panel>
      <h2 className="mb-3 mt-8 text-sm font-bold text-muted">{copy.shortcuts}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="rounded-2xl border border-line bg-[#f3f0ee] px-3 py-6 text-center hover:border-brand-blue">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full text-white anan-accent-fill">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-3 block text-sm font-bold">{messages.desk.nav[item.key]}</span>
            </Link>
          );
        })}
      </div>
      <p className="mt-6 text-xs leading-5 text-muted">{messages.desk.savedHere}</p>
    </div>
  );
}

function statusText(status: ApiOrder['status'], messages: ReturnType<typeof useI18n>['messages']): string {
  if (status === 'completed') return messages.desk.orders.statusCompleted;
  if (status === 'cancelled') return messages.desk.orders.statusCancelled;
  if (status === 'placed') return messages.desk.orders.statusPlaced;
  if (status === 'ready') return messages.desk.orders.statusReady;
  if (status === 'shipping') return messages.desk.orders.statusShipping;
  return messages.desk.orders.statusProcessing;
}

function statusesFor(order: ApiOrder): ApiOrder['status'][] {
  return ['placed', 'processing', order.deliveryMethod === 'home' ? 'shipping' : 'ready', 'completed', 'cancelled'];
}

function isToday(iso: string, now = new Date()) {
  const placed = new Date(iso);
  return placed.getFullYear() === now.getFullYear() && placed.getMonth() === now.getMonth() && placed.getDate() === now.getDate();
}

export function OrdersPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.orders;
  const { orders, failed, reload, unseen, markSeen } = useAdminOrders();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ApiOrder['status']>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (preview) setPreview(null);
      else setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);
  const list = orders ?? [];
  const today = list.filter((order) => order.status !== 'cancelled' && isToday(order.placedAt));
  const todaySales = today.reduce((sum, order) => sum + order.totalMinor, 0);
  const needle = query.trim().toLowerCase();
  const visible = list
    .filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (!needle) return true;
      const haystack = [order.number, order.customerName, order.customerEmail, order.customerPhone, order.shippingAddress, order.shippingZone]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    })
    .sort((left, right) => (sort === 'newest' ? right.placedAt.localeCompare(left.placedAt) : left.placedAt.localeCompare(right.placedAt)));

  return (
    <div>
      <PageHeader title={copy.title} subtitle={list.length === 0 ? copy.empty : undefined} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Panel>
          <p className="text-sm text-muted">{copy.todayOrders}</p>
          <p className="mt-3 text-5xl font-extrabold tabular-nums">{orders ? today.length : '…'}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{copy.todayHint}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-muted">{copy.todaySales}</p>
          <p className="mt-3 text-5xl font-extrabold tabular-nums">{orders ? formatMoney(ils(todaySales), locale) : '…'}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{copy.todayHint}</p>
        </Panel>
      </div>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
        <SearchBox value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
        <SelectInput value={status} aria-label={copy.statusAll} onChange={(event) => setStatus(event.target.value as 'all' | ApiOrder['status'])}>
          <option value="all">{copy.statusAll}</option>
          <option value="placed">{copy.statusPlaced}</option>
          <option value="processing">{copy.statusProcessing}</option>
          <option value="ready">{copy.statusReady}</option>
          <option value="shipping">{copy.statusShipping}</option>
          <option value="completed">{copy.statusCompleted}</option>
          <option value="cancelled">{copy.statusCancelled}</option>
        </SelectInput>
        <SelectInput value={sort} aria-label={copy.sortNewest} onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}>
          <option value="newest">{copy.sortNewest}</option>
          <option value="oldest">{copy.sortOldest}</option>
        </SelectInput>
      </div>
      {failed ? <p className="text-sm text-muted">{messages.account.loadFailed}</p> : null}
      {orders && visible.length === 0 ? <p className="text-sm text-muted">{list.length === 0 ? copy.empty : copy.noMatches}</p> : null}
      <div className="space-y-3">
        {visible.map((order) => (
          <Panel key={order.id} className="p-0">
            <button
              type="button"
              onClick={() => {
                markSeen(order.id);
                setSelected(order);
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-start"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-extrabold">
                  <span>#{order.number}</span>
                  {unseen.has(order.id) ? (
                    <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs font-bold text-white">{copy.newOrder}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">{order.customerName} · {order.customerPhone}</p>
              </div>
              <div className="text-end">
                <p className="font-bold tabular-nums">{formatMoney(ils(order.totalMinor), locale)}</p>
                <p className="text-xs text-muted">{statusText(order.status, messages)}</p>
              </div>
            </button>
          </Panel>
        ))}
      </div>
      {selected ? (
        <OrderDialog
          order={selected}
          onClose={() => {
            setSelected(null);
            setPreview(null);
          }}
          onPreview={setPreview}
          onSaved={(status) => {
            setSelected({ ...selected, status });
            reload();
          }}
        />
      ) : null}
      {preview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4" onMouseDown={() => setPreview(null)}>
          <div className="w-full max-w-3xl rounded-3xl bg-[#f6f3ee] p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">{preview.name}</p>
              <button type="button" aria-label={copy.closeImage} onClick={() => setPreview(null)} className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-white">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <img src={preview.src} alt={preview.name} className="mx-auto max-h-[75vh] w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderDialog({
  order,
  onClose,
  onPreview,
  onSaved,
}: {
  order: ApiOrder;
  onClose: () => void;
  onPreview: (image: { src: string; name: string }) => void;
  onSaved: (status: ApiOrder['status']) => void;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.desk.orders;
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const shipping = order.deliveryMethod === 'home' ? order.shippingAddress || order.shippingZone || messages.checkout.home : messages.checkout.pickup;

  async function saveStatus() {
    setSaving(true);
    try {
      await adminRequest(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onSaved(status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-dialog-title"
        className="my-6 w-full max-w-3xl rounded-2xl bg-[#f7f6f3] p-4 shadow-[0_16px_40px_rgb(23_32_51/0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="order-dialog-title" className="text-lg font-extrabold text-ink">
            {copy.orderLabel} {order.number}
          </h2>
          <button type="button" aria-label={copy.close} onClick={onClose} className="inline-flex size-8 items-center justify-center text-ink">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="min-w-0 flex-1">
          <SelectInput value={status} aria-label={copy.updateStatus} onChange={(event) => setStatus(event.target.value as ApiOrder['status'])}>
            {statusesFor(order).map((value) => (
              <option key={value} value={value}>
                {statusText(value, messages)}
              </option>
            ))}
          </SelectInput>
          </div>
          <PrimaryButton type="button" disabled={saving || status === order.status} onClick={() => void saveStatus()} className="shrink-0">
            {copy.updateStatus}
          </PrimaryButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white px-4 text-sm">
            <p className="flex items-start justify-between gap-4 border-b border-line py-3">
              <span className="text-muted">{messages.checkout.shipping}</span>
              <span className="text-end font-semibold">{shipping}</span>
            </p>
            <div className="flex items-start justify-between gap-4 border-b border-line py-3">
              <span className="text-muted">{copy.customer}</span>
              <span className="text-end">
                <span className="block font-semibold">{order.customerName}</span>
                <span className="block">{order.customerEmail}</span>
                <span className="block">{order.customerPhone}</span>
              </span>
            </div>
            <p className="flex items-center justify-between gap-4 border-b border-line py-3">
              <span className="text-muted">{copy.subtotal}</span>
              <span className="font-semibold tabular-nums">{formatMoney(ils(order.subtotalMinor), locale)}</span>
            </p>
            {order.discountMinor > 0 ? (
              <p className="flex items-center justify-between gap-4 border-b border-line py-3">
                <span className="text-muted">{copy.discount}</span>
                <span className="font-semibold tabular-nums">−{formatMoney(ils(order.discountMinor), locale)}</span>
              </p>
            ) : null}
            <p className="flex items-center justify-between gap-4 border-b border-line py-3">
              <span className="text-muted">{messages.checkout.shipping}</span>
              <span className="font-semibold tabular-nums">{formatMoney(ils(order.deliveryMinor), locale)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 py-3 font-extrabold">
              <span>{copy.total}</span>
              <span className="tabular-nums">{formatMoney(ils(order.totalMinor), locale)}</span>
            </p>
            {order.note ? <p className="border-t border-line py-3 text-muted">{copy.note}: {order.note}</p> : null}
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 text-sm">
            <h3 className="font-extrabold text-ink">{copy.invoice}</h3>
            <p className="mt-3 leading-6 text-muted">{copy.invoicePending}</p>
          </section>
        </div>
        <section className="mt-3 rounded-2xl border border-line bg-white px-4">
          <h3 className="border-b border-line py-3 text-end text-sm font-bold text-ink">{copy.items}</h3>
          <ul>
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 border-b border-line py-3 text-sm last:border-b-0">
                {item.image ? (
                  <button type="button" onClick={() => onPreview({ src: item.image, name: item.name[locale] })} className="shrink-0">
                    <img src={item.image} alt={item.name[locale]} className="size-14 rounded-md object-contain" />
                  </button>
                ) : (
                  <span className="size-14 shrink-0 rounded-md bg-[#f3f0ee]" />
                )}
                <span className="min-w-0 flex-1">
                  {item.name[locale]} × {item.quantity}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatMoney(ils(item.lineTotalMinor), locale)}</span>
              </li>
            ))}
          </ul>
        </section>
        <button type="button" onClick={onClose} className="mt-4 h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink">
          {copy.close}
        </button>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.customers;
  const { orders } = useAdminOrders();
  const grouped = new Map<string, { name: string; email: string; phone: string; count: number; totalMinor: number }>();
  for (const order of orders ?? []) {
    const key = order.customerEmail || order.customerPhone || order.id;
    const current = grouped.get(key) ?? {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      count: 0,
      totalMinor: 0,
    };
    current.count += 1;
    current.totalMinor += order.totalMinor;
    grouped.set(key, current);
  }
  const customers = [...grouped.values()];

  return (
    <div>
      <PageHeader title={copy.title} subtitle={customers.length === 0 ? copy.empty : undefined} />
      <div className="space-y-3">
        {customers.map((customer) => (
          <Panel key={customer.email || customer.phone}>
            <p className="font-extrabold">{customer.name}</p>
            <p className="mt-1 text-sm text-muted">{customer.email} · {customer.phone}</p>
            <p className="mt-2 text-sm font-bold">
              {customer.count} · {formatMoney(ils(customer.totalMinor), locale)}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { messages } = useI18n();
  return (
    <div>
      <PageHeader title={messages.desk.messages.title} subtitle={messages.desk.messages.empty} />
    </div>
  );
}

