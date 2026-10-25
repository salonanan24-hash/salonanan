import { formatMoney, ils } from '@anan/shared';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { useAdminStore } from '@/admin/store';
import { useAdminOrders } from '@/admin/use-orders';
import { Panel } from '@/admin/ui';
import { useI18n } from '@/i18n';
import type { ApiOrder } from '@/orders/api';

type Preset = '7' | '30' | '90' | 'month' | 'custom';
type Status = ApiOrder['status'];

const statuses: Status[] = ['placed', 'processing', 'ready', 'shipping', 'completed', 'cancelled'];
const statusColor: Record<Status, string> = {
  placed: '#0C5695',
  processing: '#7d8da3',
  ready: '#c4a15a',
  shipping: '#3d6b8a',
  completed: '#1f6b4a',
  cancelled: '#E52629',
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function customerKey(order: ApiOrder) {
  return (order.customerEmail || order.customerPhone || order.id).trim().toLowerCase();
}

export function ReportsPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.reports;
  const products = useAdminStore((state) => state.products.length);
  const { orders } = useAdminOrders();
  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const list = orders ?? [];

  const range = useMemo(() => {
    const today = startOfDay(new Date());
    const end = endOfDay(new Date());
    if (preset === '7') return { from: addDays(today, -6), to: end };
    if (preset === '90') return { from: addDays(today, -89), to: end };
    if (preset === 'month') return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: end };
    if (preset === 'custom') {
      const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : addDays(today, -29);
      const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : end;
      return to < from ? { from: startOfDay(to), to: endOfDay(from) } : { from, to };
    }
    return { from: addDays(today, -29), to: end };
  }, [preset, customFrom, customTo]);

  const inRange = list.filter((order) => {
    const placed = new Date(order.placedAt).getTime();
    return placed >= range.from.getTime() && placed <= range.to.getTime();
  });
  const active = inRange.filter((order) => order.status !== 'cancelled');
  const revenueMinor = active.reduce((sum, order) => sum + order.totalMinor, 0);
  const subtotalMinor = active.reduce((sum, order) => sum + order.subtotalMinor, 0);
  const shippingMinor = active.reduce((sum, order) => sum + order.deliveryMinor, 0);
  const allTimeMinor = list.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.totalMinor, 0);
  const averageMinor = active.length > 0 ? Math.round(revenueMinor / active.length) : 0;
  const cancelled = inRange.filter((order) => order.status === 'cancelled').length;

  const firstOrder = new Map<string, number>();
  for (const order of list) {
    const key = customerKey(order);
    const time = new Date(order.placedAt).getTime();
    const previous = firstOrder.get(key);
    if (previous === undefined || time < previous) firstOrder.set(key, time);
  }
  const newCustomers = [...firstOrder.values()].filter((time) => time >= range.from.getTime() && time <= range.to.getTime()).length;

  const statusCounts = statuses.map((status) => ({
    status,
    label: statusLabel(status, messages),
    count: inRange.filter((order) => order.status === status).length,
    color: statusColor[status],
  }));

  const days = useMemo(() => {
    const buckets: { date: Date; total: number }[] = [];
    for (let cursor = startOfDay(range.from); cursor <= range.to; cursor = addDays(cursor, 1)) {
      buckets.push({ date: new Date(cursor), total: 0 });
    }
    const index = new Map(buckets.map((bucket, position) => [dateKey(bucket.date), position]));
    for (const order of active) {
      const position = index.get(dateKey(new Date(order.placedAt)));
      const bucket = position === undefined ? undefined : buckets[position];
      if (bucket) bucket.total += order.totalMinor;
    }
    return buckets;
  }, [active, range.from, range.to]);

  const leaders = [...active.reduce((map, order) => {
    const key = customerKey(order);
    const current = map.get(key) ?? {
      name: order.customerName,
      email: order.customerEmail,
      orders: 0,
      totalMinor: 0,
    };
    current.orders += 1;
    current.totalMinor += order.totalMinor;
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; email: string; orders: number; totalMinor: number }>()).values()]
    .sort((left, right) => right.totalMinor - left.totalMinor)
    .slice(0, 8);

  const presets: { id: Preset; label: string }[] = [
    { id: '7', label: copy.days7 },
    { id: '30', label: copy.days30 },
    { id: '90', label: copy.days90 },
    { id: 'month', label: copy.thisMonth },
    { id: 'custom', label: copy.custom },
  ];

  async function exportPdf() {
    const node = sheetRef.current;
    if (!node || exporting) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const previousLeft = node.style.left;
      node.style.left = '0px';
      node.style.zIndex = '80';
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      } finally {
        node.style.left = previousLeft;
        node.style.zIndex = '';
      }
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const image = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(image, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(image, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`anan-report-${dateKey(range.from)}-${dateKey(range.to)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const money = (minor: number) => (orders ? formatMoney(ils(minor), locale) : '…');
  const countText = (value: number) => (orders ? String(value) : '…');

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.subtitle}</p>
        </header>
        <button
          type="button"
          onClick={() => void exportPdf()}
          disabled={exporting || !orders}
          className="inline-flex h-10 shrink-0 items-center rounded-full border border-line bg-white px-4 text-sm font-bold text-ink disabled:opacity-50"
        >
          {copy.exportPdf}
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{copy.totalRevenue}</p>
            <p className="text-xs text-muted">{copy.sinceStart}</p>
            <p className="mt-2 text-4xl font-extrabold tabular-nums">{money(allTimeMinor)}</p>
          </div>
          <div className="text-end">
            <p className="text-xs text-muted">{copy.dateRange}</p>
            <p className="mt-2 text-sm font-semibold">{formatDay(range.from, locale)} – {formatDay(range.to, locale)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {presets.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`h-9 rounded-full px-3 text-sm font-bold ${preset === item.id ? 'bg-ink text-white' : 'border border-line bg-white text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <label className="text-xs text-muted">
              {copy.from}
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="ms-2 h-9 rounded-lg border border-line px-2 text-sm text-ink" />
            </label>
            <label className="text-xs text-muted">
              {copy.to}
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="ms-2 h-9 rounded-lg border border-line px-2 text-sm text-ink" />
            </label>
          </div>
        ) : null}
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Metric label={copy.revenue} value={money(revenueMinor)} />
        <Metric label={copy.orders} value={countText(active.length)} />
        <Metric label={copy.average} value={money(averageMinor)} />
        <Metric label={copy.cancelled} value={countText(cancelled)} />
        <Metric label={copy.newCustomers} value={countText(newCustomers)} />
        <Metric label={copy.products} value={String(products)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Metric label={copy.subtotal} value={money(subtotalMinor)} />
        <Metric label={copy.shipping} value={money(shippingMinor)} />
        <Metric label={copy.credit} value={money(0)} hint={copy.unpaid} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel>
          <h2 className="text-sm font-bold text-ink">{copy.statusSplit}</h2>
          {inRange.length === 0 ? <p className="mt-6 text-sm text-muted">{copy.noOrders}</p> : <StatusDonut parts={statusCounts} />}
        </Panel>
        <Panel>
          <h2 className="text-sm font-bold text-ink">{copy.daily}</h2>
          <DailyChart days={days} locale={locale} />
        </Panel>
      </div>

      <Panel className="mt-3">
        <h2 className="text-sm font-bold text-ink">{copy.topCustomers}</h2>
        {leaders.length === 0 ? <p className="mt-4 text-sm text-muted">{copy.noCustomers}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-2 text-start font-semibold">{copy.customer}</th>
                  <th className="px-2 py-2 text-start font-semibold">{copy.email}</th>
                  <th className="px-2 py-2 text-start font-semibold">{copy.orders}</th>
                  <th className="px-2 py-2 text-start font-semibold">{copy.revenue}</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((customer) => (
                  <tr key={`${customer.email}-${customer.name}`} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-3 font-semibold">{customer.name}</td>
                    <td className="px-2 py-3">{customer.email}</td>
                    <td className="px-2 py-3 tabular-nums">{customer.orders}</td>
                    <td className="px-2 py-3 font-bold tabular-nums">{formatMoney(ils(customer.totalMinor), locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ReportSheet
        sheetRef={sheetRef}
        locale={locale}
        title={copy.title}
        rangeLabel={`${formatDay(range.from, locale)} – ${formatDay(range.to, locale)}`}
        rows={[
          [copy.revenue, money(revenueMinor)],
          [copy.orders, countText(active.length)],
          [copy.average, money(averageMinor)],
          [copy.cancelled, countText(cancelled)],
          [copy.newCustomers, countText(newCustomers)],
          [copy.products, String(products)],
          [copy.subtotal, money(subtotalMinor)],
          [copy.shipping, money(shippingMinor)],
          [copy.credit, `${money(0)} — ${copy.unpaid}`],
        ]}
        statusTitle={copy.statusSplit}
        statuses={statusCounts.map((part) => [part.label, String(part.count)])}
        dailyTitle={copy.daily}
        days={days.map((day) => [formatDay(day.date, locale), formatMoney(ils(day.total), locale)])}
        customersTitle={copy.topCustomers}
        customerHead={[copy.customer, copy.email, copy.orders, copy.revenue]}
        customers={leaders.map((customer) => [customer.name, customer.email, String(customer.orders), formatMoney(ils(customer.totalMinor), locale)])}
        emptyCustomers={copy.noCustomers}
        ordersTitle={copy.orders}
        orderHead={[messages.account.orderNumber, messages.account.date, copy.customer, copy.email, messages.checkout.phone, messages.account.status, copy.subtotal, copy.shipping, copy.revenue]}
        orders={inRange.map((order) => [
          order.number,
          formatDay(new Date(order.placedAt), locale),
          order.customerName,
          order.customerEmail,
          order.customerPhone,
          statusLabel(order.status, messages),
          formatMoney(ils(order.subtotalMinor), locale),
          formatMoney(ils(order.deliveryMinor), locale),
          formatMoney(ils(order.totalMinor), locale),
        ])}
        emptyOrders={copy.noOrders}
      />
    </div>
  );
}

function ReportSheet({
  sheetRef,
  locale,
  title,
  rangeLabel,
  rows,
  statusTitle,
  statuses,
  dailyTitle,
  days,
  customersTitle,
  customerHead,
  customers,
  emptyCustomers,
  ordersTitle,
  orderHead,
  orders,
  emptyOrders,
}: {
  sheetRef: RefObject<HTMLDivElement | null>;
  locale: 'he' | 'ar';
  title: string;
  rangeLabel: string;
  rows: [string, string][];
  statusTitle: string;
  statuses: [string, string][];
  dailyTitle: string;
  days: [string, string][];
  customersTitle: string;
  customerHead: string[];
  customers: string[][];
  emptyCustomers: string;
  ordersTitle: string;
  orderHead: string[];
  orders: string[][];
  emptyOrders: string;
}) {
  const font = locale === 'ar' ? 'Noto Sans Arabic, Arial, sans-serif' : 'Heebo, Arial Hebrew, Arial, sans-serif';
  return (
    <div
      ref={sheetRef}
      dir="rtl"
      aria-hidden="true"
      style={{ position: 'fixed', left: '-12000px', top: 0, width: '794px', padding: '32px', background: '#ffffff', color: '#172033', fontFamily: font }}
    >
      <h1 style={{ margin: 0, fontSize: '28px' }}>{title}</h1>
      <p style={{ margin: '8px 0 20px', fontSize: '14px' }}>{rangeLabel}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '8px', fontSize: '14px' }}>{label}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '8px', fontSize: '14px', fontWeight: 700 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>{statusTitle}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <tbody>
          {statuses.map(([label, count]) => (
            <tr key={label}>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '13px' }}>{label}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '13px' }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>{dailyTitle}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <tbody>
          {days.map(([label, value]) => (
            <tr key={label}>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '13px' }}>{label}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '13px' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>{customersTitle}</h2>
      {customers.length === 0 ? <p style={{ fontSize: '13px' }}>{emptyCustomers}</p> : <SheetTable head={customerHead} rows={customers} />}
      <h2 style={{ fontSize: '16px', margin: '16px 0 8px' }}>{ordersTitle}</h2>
      {orders.length === 0 ? <p style={{ fontSize: '13px' }}>{emptyOrders}</p> : <SheetTable head={orderHead} rows={orders} />}
    </div>
  );
}

function SheetTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '12px', textAlign: 'start' }}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} style={{ borderBottom: '1px solid #e5e7eb', padding: '6px', fontSize: '12px' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </Panel>
  );
}

function statusLabel(status: Status, messages: ReturnType<typeof useI18n>['messages']) {
  if (status === 'completed') return messages.desk.orders.statusCompleted;
  if (status === 'cancelled') return messages.desk.orders.statusCancelled;
  if (status === 'placed') return messages.desk.orders.statusPlaced;
  if (status === 'ready') return messages.desk.orders.statusReady;
  if (status === 'shipping') return messages.desk.orders.statusShipping;
  return messages.desk.orders.statusProcessing;
}

function formatDay(date: Date, locale: 'he' | 'ar') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-IL' : 'he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
}

function StatusDonut({ parts }: { parts: { label: string; count: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e7e7e7" strokeWidth="16" />
        {parts.map((part) => {
          if (part.count === 0 || total === 0) return null;
          const length = (part.count / total) * circumference;
          const circle = (
            <circle
              key={part.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
        {parts.map((part) => (
          <li key={part.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: part.color }} />
            {part.label} ({part.count})
          </li>
        ))}
      </ul>
    </div>
  );
}

function DailyChart({ days, locale }: { days: { date: Date; total: number }[]; locale: 'he' | 'ar' }) {
  const width = 560;
  const height = 200;
  const pad = 28;
  const max = Math.max(...days.map((day) => day.total), 1);
  const points = days.map((day, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(days.length - 1, 1);
    const y = height - pad - (day.total / max) * (height - pad * 2);
    return { x, y, day };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const labelStep = Math.max(1, Math.ceil(days.length / 6));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-52 w-full">
      <polygon points={area} fill="#0C5695" opacity="0.12" />
      <polyline points={line} fill="none" stroke="#0C5695" strokeWidth="2.5" />
      {points.filter((_, index) => index % labelStep === 0 || index === points.length - 1).map((point) => (
        <text key={dateKey(point.day.date)} x={point.x} y={height - 6} textAnchor="middle" fill="#5c6775" fontSize="11">
          {formatDay(point.day.date, locale).replace(/\s+\d{4}$/, '')}
        </text>
      ))}
    </svg>
  );
}
