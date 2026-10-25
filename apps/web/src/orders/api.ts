import { getBrowserSupabase } from '@/lib/supabase';

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type ApiOrder = {
  id: string;
  number: string;
  placedAt: string;
  status: 'placed' | 'processing' | 'ready' | 'shipping' | 'completed' | 'cancelled';
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  couponCode: string;
  note: string;
  deliveryMethod: 'pickup' | 'home';
  deliveryMinor: number;
  shippingZone: string;
  shippingAddress: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    id: string;
    name: { he: string; ar: string };
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    image: string;
  }>;
};

export type Quote = {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  couponCode: string;
};

async function token(): Promise<string> {
  const client = getBrowserSupabase();
  const session = client ? (await client.auth.getSession()).data.session : null;
  return session?.access_token ?? '';
}

async function request<T>(path: string, init?: RequestInit, auth = false): Promise<T> {
  const access = auth ? await token() : '';
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as { error?: { code?: string }; order?: T; orders?: T } | null;
  if (!response.ok) {
    throw new Error(body?.error?.code ?? 'failed');
  }
  return body as T;
}

export function quoteOrder(input: { lines: { productId: string; quantity: number }[]; couponCode: string }) {
  return request<Quote>('/api/orders/quote', { method: 'POST', body: JSON.stringify(input) });
}

export type ShippingZone = { id: string; nameHe: string; nameAr: string; priceMinor: number };

export function shippingZones() {
  return request<{ zones: ShippingZone[] }>('/api/orders/shipping-zones');
}

export function placeOrder(input: {
  lines: { productId: string; quantity: number }[];
  couponCode: string;
  note: string;
  locale: 'he' | 'ar';
  customer: { name: string; email: string; phone: string };
  delivery: {
    method: 'pickup' | 'home';
    zoneId: string;
    city: string;
    street: string;
    house: string;
    apartment: string;
  };
}) {
  return request<{ order: ApiOrder }>('/api/orders', { method: 'POST', body: JSON.stringify(input) }, true);
}

export async function myOrders(): Promise<ApiOrder[]> {
  const body = await request<{ orders: ApiOrder[] }>('/api/orders', undefined, true);
  return body.orders;
}

export async function myOrder(id: string): Promise<ApiOrder> {
  const body = await request<{ order: ApiOrder }>(`/api/orders/${id}`, undefined, true);
  return body.order;
}
