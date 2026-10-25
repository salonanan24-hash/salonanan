import { z } from 'zod';
import { idSchema } from '../admin/catalog.js';
import { AppError } from '../errors/app-error.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';

const textSchema = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(200);

export const packageInput = z.object({
  id: idSchema,
  nameHe: textSchema,
  nameAr: optionalText,
  priceMinor: z.number().int().min(0).max(10_000_000),
  active: z.boolean(),
  productIds: z.array(idSchema).min(2).max(30),
});

export type PackageRecord = {
  id: string;
  nameHe: string;
  nameAr: string;
  priceMinor: number;
  active: boolean;
  productIds: string[];
};

function db() {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  return getSupabaseAdmin();
}

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  throw new AppError(500, 'database', 'Database write failed');
}

async function itemsByPackage(ids: string[]) {
  const grouped = new Map<string, string[]>();
  if (ids.length === 0) return grouped;
  const result = await db().from('package_items').select('package_id, product_id').in('package_id', ids);
  fail(result.error);
  for (const row of result.data ?? []) {
    const list = grouped.get(row.package_id) ?? [];
    list.push(row.product_id);
    grouped.set(row.package_id, list);
  }
  return grouped;
}

function mapPackage(
  row: { id: string; name_he: string; name_ar: string; price_minor: number; is_active: boolean },
  productIds: string[],
): PackageRecord {
  return {
    id: row.id,
    nameHe: row.name_he,
    nameAr: row.name_ar || row.name_he,
    priceMinor: row.price_minor,
    active: row.is_active,
    productIds,
  };
}

export async function listPackages(activeOnly: boolean): Promise<PackageRecord[]> {
  let query = db().from('packages').select('id, name_he, name_ar, price_minor, is_active, sort_order').order('sort_order');
  if (activeOnly) query = query.eq('is_active', true);
  const result = await query;
  fail(result.error);
  const rows = result.data ?? [];
  const items = await itemsByPackage(rows.map((row) => row.id));
  return rows.map((row) => mapPackage(row, items.get(row.id) ?? []));
}

export async function savePackage(input: z.infer<typeof packageInput>): Promise<void> {
  const productIds = [...new Set(input.productIds)];
  if (productIds.length < 2) throw new AppError(400, 'products', 'Choose at least two products');
  const products = await db().from('products').select('id').in('id', productIds);
  fail(products.error);
  if ((products.data ?? []).length !== productIds.length) {
    throw new AppError(400, 'products', 'A selected product is no longer available');
  }

  const existing = await db().from('packages').select('sort_order').eq('id', input.id).maybeSingle();
  fail(existing.error);
  const sortOrder = existing.data?.sort_order ?? (await nextSort());
  const saved = await db().from('packages').upsert({
    id: input.id,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    price_minor: input.priceMinor,
    is_active: input.active,
    sort_order: sortOrder,
  });
  fail(saved.error);

  const cleared = await db().from('package_items').delete().eq('package_id', input.id);
  fail(cleared.error);
  const inserted = await db().from('package_items').insert(
    productIds.map((productId) => ({
      id: `pi-${crypto.randomUUID()}`,
      package_id: input.id,
      product_id: productId,
    })),
  );
  fail(inserted.error);
}

export async function deletePackage(id: string): Promise<void> {
  const result = await db().from('packages').delete().eq('id', id);
  fail(result.error);
}

async function nextSort(): Promise<number> {
  const result = await db().from('packages').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  fail(result.error);
  return (result.data?.[0]?.sort_order ?? 0) + 1;
}
