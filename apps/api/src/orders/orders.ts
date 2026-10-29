import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';

const lineSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  variantId: z.string().trim().max(80).default(''),
  quantity: z.number().int().min(1).max(10),
});

export const quoteSchema = z.object({
  lines: z.array(lineSchema).min(1).max(30),
  couponCode: z.string().trim().max(40).default(''),
});

export const placeSchema = quoteSchema.extend({
  note: z.string().trim().max(500).default(''),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(8).max(30),
  }),
  locale: z.enum(['he', 'ar']).default('he'),
  delivery: z.object({
    method: z.enum(['pickup', 'home']),
    zoneId: z.string().trim().max(80).default(''),
    city: z.string().trim().max(80).default(''),
    street: z.string().trim().max(120).default(''),
    house: z.string().trim().max(20).default(''),
    apartment: z.string().trim().max(20).default(''),
  }),
});

type PricedLine = {
  productId: string;
  variantId: string;
  name: { he: string; ar: string };
  image: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  stock: number;
};

export type StoredOrder = {
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

function db() {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  return getSupabaseAdmin();
}

export async function optionalUser(req: Request) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data } = await db().auth.getUser(token);
  return data.user ?? null;
}

async function pricedLines(lines: z.infer<typeof lineSchema>[]): Promise<PricedLine[]> {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const products = await db().from('products').select('id, name_he, name_ar, price_minor').in('id', ids);
  if (products.error) throw new AppError(500, 'database', 'Database write failed');
  const variants = await db()
    .from('product_variants')
    .select('id, product_id, color, sku, price_minor, stock, is_active, sort_order')
    .in('product_id', ids)
    .order('sort_order');
  if (variants.error) throw new AppError(500, 'database', 'Database write failed');
  const variantIds = (variants.data ?? []).map((variant) => variant.id);
  const images =
    variantIds.length === 0
      ? { data: [], error: null }
      : await db().from('variant_images').select('variant_id, src, sort_order').in('variant_id', variantIds).order('sort_order');
  if (images.error) throw new AppError(500, 'database', 'Database write failed');
  const specRows =
    variantIds.length === 0
      ? { data: [], error: null }
      : await db().from('variant_specs').select('variant_id, value').in('variant_id', variantIds);
  if (specRows.error) throw new AppError(500, 'database', 'Database write failed');

  return lines.map((line) => {
    const product = (products.data ?? []).find((item) => item.id === line.productId);
    if (!product) throw new AppError(400, 'missing_product', 'A cart product is no longer available');
    const choices = (variants.data ?? [])
      .filter((variant) => variant.product_id === product.id && variant.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
    const requested = line.variantId ? choices.find((item) => item.id === line.variantId) : undefined;
    const variant = requested ?? choices.find((item) => item.stock >= line.quantity) ?? choices[0];
    if (!variant || variant.stock < line.quantity) {
      throw new AppError(409, 'stock', 'Not enough stock');
    }
    const image =
      (images.data ?? []).find((item) => item.variant_id === variant.id)?.src ??
      (images.data ?? []).find((item) => choices.some((choice) => choice.id === item.variant_id))?.src ??
      '';
    const unitPriceMinor = variant.price_minor ?? product.price_minor;
    const size = variant.color.trim();
    const model =
      (specRows.data ?? [])
        .find((row) => row.variant_id === variant.id && /[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/.test(row.value ?? ''))
        ?.value.match(/[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/)?.[0] ?? '';
    const withSize = (name: string) => {
      const sized = size && !name.includes(size) ? `${name} ${size}` : name;
      return model && !sized.includes(model) ? `${sized} ${model}` : sized;
    };
    return {
      productId: product.id,
      variantId: variant.id,
      name: {
        he: withSize(product.name_he),
        ar: withSize(product.name_ar),
      },
      image,
      unitPriceMinor,
      quantity: line.quantity,
      lineTotalMinor: unitPriceMinor * line.quantity,
      stock: variant.stock,
    };
  });
}

async function discountFor(subtotalMinor: number, couponCode: string): Promise<{ code: string; discountMinor: number }> {
  const code = couponCode.trim().toUpperCase();
  if (!code) return { code: '', discountMinor: 0 };
  const coupon = await db().from('coupons').select('code, kind, value, ends_at').eq('code', code).maybeSingle();
  if (coupon.error) throw new AppError(500, 'database', 'Database write failed');
  if (!coupon.data) throw new AppError(400, 'coupon', 'Coupon was not found');
  if (coupon.data.ends_at && coupon.data.ends_at < new Date().toISOString().slice(0, 10)) {
    throw new AppError(400, 'coupon', 'Coupon was not found');
  }
  const discountMinor =
    coupon.data.kind === 'percent'
      ? Math.min(subtotalMinor, Math.round((subtotalMinor * coupon.data.value) / 100))
      : Math.min(subtotalMinor, coupon.data.value);
  return { code: coupon.data.code, discountMinor };
}

export async function quoteOrder(input: z.infer<typeof quoteSchema>) {
  const lines = await pricedLines(input.lines);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const coupon = await discountFor(subtotalMinor, input.couponCode);
  return {
    subtotalMinor,
    discountMinor: coupon.discountMinor,
    totalMinor: subtotalMinor - coupon.discountMinor,
    couponCode: coupon.code,
  };
}

function mapOrder(row: Record<string, unknown>, items: StoredOrder['items']): StoredOrder {
  return {
    id: String(row.id),
    number: String(row.number),
    placedAt: String(row.placed_at),
    status: row.status as StoredOrder['status'],
    subtotalMinor: Number(row.subtotal_minor),
    discountMinor: Number(row.discount_minor),
    totalMinor: Number(row.total_minor),
    couponCode: String(row.coupon_code ?? ''),
    note: String(row.note ?? ''),
    deliveryMethod: row.delivery_method === 'home' ? 'home' : 'pickup',
    deliveryMinor: Number(row.delivery_minor ?? 0),
    shippingZone: String(row.shipping_zone ?? ''),
    shippingAddress: String(row.shipping_address ?? ''),
    customerName: String(row.customer_name ?? ''),
    customerEmail: String(row.customer_email ?? ''),
    customerPhone: String(row.customer_phone ?? ''),
    items,
  };
}

async function itemsFor(orderIds: string[]): Promise<Map<string, StoredOrder['items']>> {
  const grouped = new Map<string, StoredOrder['items']>();
  if (orderIds.length === 0) return grouped;
  const result = await db()
    .from('order_items')
    .select('id, order_id, product_name_he, product_name_ar, image_src, unit_price_minor, quantity, line_total_minor')
    .in('order_id', orderIds);
  if (result.error) throw new AppError(500, 'database', 'Database write failed');
  for (const item of result.data ?? []) {
    const list = grouped.get(item.order_id) ?? [];
    list.push({
      id: item.id,
      name: { he: item.product_name_he, ar: item.product_name_ar },
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
      image: item.image_src,
    });
    grouped.set(item.order_id, list);
  }
  return grouped;
}

async function decrementStock(lines: PricedLine[]) {
  const applied: PricedLine[] = [];
  for (const line of lines) {
    const next = line.stock - line.quantity;
    const result = await db()
      .from('product_variants')
      .update({ stock: next })
      .eq('id', line.variantId)
      .eq('stock', line.stock)
      .select('id');
    if (result.error || !result.data?.length) {
      await restoreStock(applied);
      throw new AppError(409, 'stock', 'Not enough stock');
    }
    applied.push(line);
  }
}

async function restoreStock(lines: PricedLine[]) {
  for (const line of lines) {
    await db()
      .from('product_variants')
      .update({ stock: line.stock })
      .eq('id', line.variantId)
      .eq('stock', line.stock - line.quantity);
  }
}

export async function listShippingZones() {
  const result = await db()
    .from('shipping_zones')
    .select('id, name, name_ar, price_minor, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (result.error) throw new AppError(500, 'database', 'Database write failed');
  return (result.data ?? []).map((zone) => ({
    id: zone.id,
    nameHe: zone.name,
    nameAr: zone.name_ar || zone.name,
    priceMinor: zone.price_minor,
  }));
}

async function deliveryFor(input: z.infer<typeof placeSchema>['delivery'], locale: 'he' | 'ar') {
  if (input.method === 'pickup') {
    return { method: 'pickup' as const, minor: 0, zoneName: '', address: '' };
  }
  if (!input.city || !input.street || !input.house) {
    throw new AppError(400, 'address', 'Address is required');
  }
  const zones = await listShippingZones();
  const zone = zones.find((item) => item.id === input.zoneId);
  if (!zone) throw new AppError(400, 'zone', 'Choose a shipping area');
  const zoneName = locale === 'ar' ? zone.nameAr : zone.nameHe;
  const address = [input.street, input.house, input.apartment, input.city, zoneName].filter(Boolean).join(', ');
  return { method: 'home' as const, minor: zone.priceMinor, zoneName, address };
}

export async function placeOrder(input: z.infer<typeof placeSchema>, customerId: string | null): Promise<StoredOrder> {
  const lines = await pricedLines(input.lines);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const coupon = await discountFor(subtotalMinor, input.couponCode);
  const delivery = await deliveryFor(input.delivery, input.locale);
  const totalMinor = subtotalMinor - coupon.discountMinor + delivery.minor;
  await decrementStock(lines);

  const id = `ord-${crypto.randomUUID()}`;
  const number = String(10000000 + Math.floor(Math.random() * 90000000));
  const inserted = await db()
    .from('orders')
    .insert({
      id,
      number,
      customer_id: customerId,
      customer_email: input.customer.email.toLowerCase(),
      customer_name: input.customer.name,
      customer_phone: input.customer.phone,
      status: 'placed',
      subtotal_minor: subtotalMinor,
      discount_minor: coupon.discountMinor,
      total_minor: totalMinor,
      coupon_code: coupon.code,
      note: input.note,
      locale: input.locale,
      delivery_method: delivery.method,
      delivery_minor: delivery.minor,
      shipping_zone: delivery.zoneName,
      shipping_address: delivery.address,
    })
    .select('*')
    .single();
  if (inserted.error || !inserted.data) {
    await restoreStock(lines);
    throw new AppError(500, 'database', 'Database write failed');
  }

  const itemRows = lines.map((line) => ({
    id: `item-${crypto.randomUUID()}`,
    order_id: id,
    product_id: line.productId,
    variant_id: line.variantId,
    product_name_he: line.name.he,
    product_name_ar: line.name.ar,
    image_src: line.image,
    unit_price_minor: line.unitPriceMinor,
    quantity: line.quantity,
    line_total_minor: line.lineTotalMinor,
  }));
  const items = await db().from('order_items').insert(itemRows);
  if (items.error) {
    await db().from('orders').delete().eq('id', id);
    await restoreStock(lines);
    throw new AppError(500, 'database', 'Database write failed');
  }

  return mapOrder(inserted.data, itemRows.map((item) => ({
    id: item.id,
    name: { he: item.product_name_he, ar: item.product_name_ar },
    quantity: item.quantity,
    unitPriceMinor: item.unit_price_minor,
    lineTotalMinor: item.line_total_minor,
    image: item.image_src,
  })));
}

export async function listOrdersForUser(userId: string, email: string): Promise<StoredOrder[]> {
  const byId = await db().from('orders').select('*').eq('customer_id', userId).order('placed_at', { ascending: false });
  if (byId.error) throw new AppError(500, 'database', 'Database write failed');
  const byEmail = email
    ? await db().from('orders').select('*').ilike('customer_email', email).order('placed_at', { ascending: false })
    : { data: [], error: null };
  if (byEmail.error) throw new AppError(500, 'database', 'Database write failed');
  const rows = [...(byId.data ?? []), ...(byEmail.data ?? [])];
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  const items = await itemsFor(unique.map((row) => row.id));
  return unique.map((row) => mapOrder(row, items.get(row.id) ?? []));
}

export async function orderForUser(id: string, userId: string, email: string): Promise<StoredOrder> {
  const orders = await listOrdersForUser(userId, email);
  const order = orders.find((item) => item.id === id);
  if (!order) throw new AppError(404, 'not_found', 'Order was not found');
  return order;
}

const orderStatusSchema = z.enum(['placed', 'processing', 'ready', 'shipping', 'completed', 'cancelled']);

export async function updateOrderStatus(id: string, status: z.infer<typeof orderStatusSchema>): Promise<void> {
  const current = await db().from('orders').select('id, delivery_method').eq('id', id).maybeSingle();
  if (current.error) throw new AppError(500, 'database', 'Database write failed');
  if (!current.data) throw new AppError(404, 'not_found', 'Order was not found');
  const home = current.data.delivery_method === 'home';
  if (status === 'ready' && home) throw new AppError(400, 'status', 'Ready is only for store pickup');
  if (status === 'shipping' && !home) throw new AppError(400, 'status', 'Shipping is only for home delivery');
  const result = await db().from('orders').update({ status }).eq('id', id).select('id').maybeSingle();
  if (result.error) throw new AppError(500, 'database', 'Database write failed');
  if (!result.data) throw new AppError(404, 'not_found', 'Order was not found');
}

export async function countRegisteredCustomers(): Promise<number> {
  let page = 1;
  let total = 0;
  for (;;) {
    const result = await db().auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new AppError(500, 'database', 'Database write failed');
    const batch = result.data.users.length;
    total += batch;
    if (batch < 200 || page >= 20) break;
    page += 1;
  }
  return total;
}

export async function listAllOrders(): Promise<StoredOrder[]> {
  const result = await db().from('orders').select('*').order('placed_at', { ascending: false });
  if (result.error) throw new AppError(500, 'database', 'Database write failed');
  const rows = result.data ?? [];
  const items = await itemsFor(rows.map((row) => row.id));
  return rows.map((row) => mapOrder(row, items.get(row.id) ?? []));
}
