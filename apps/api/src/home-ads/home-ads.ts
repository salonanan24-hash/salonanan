import { z } from 'zod';
import { idSchema } from '../admin/catalog.js';
import { AppError } from '../errors/app-error.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';

const targetKind = z.enum(['none', 'category', 'subcategory', 'brand', 'product', 'package']);
const targetRef = z
  .string()
  .trim()
  .max(80)
  .refine((value) => value === '' || /^[a-zA-Z0-9_-]{1,80}$/.test(value), 'target');

const imageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000_000)
  .refine(isSafeImage, 'image');

export const homeAdsInput = z.object({
  ads: z
    .array(
      z.object({
        id: idSchema,
        image: imageSchema,
        targetKind,
        targetRef,
      }),
    )
    .max(8),
});

export type HomeAd = {
  id: string;
  image: string;
  targetKind: z.infer<typeof targetKind>;
  targetRef: string;
};

function db() {
  if (!isSupabaseConfigured()) throw new AppError(503, 'not_configured', 'Database is not configured');
  return getSupabaseAdmin();
}

function fail(error: { message: string } | null): void {
  if (!error) return;
  throw new AppError(500, 'database', 'Database write failed');
}

function isSafeImage(value: string): boolean {
  if (
    value.startsWith('data:image/jpeg;base64,') ||
    value.startsWith('data:image/png;base64,') ||
    value.startsWith('data:image/webp;base64,')
  ) {
    return true;
  }
  if (value.startsWith('/') && !value.includes('..') && !value.includes('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function listHomeAds(): Promise<HomeAd[]> {
  const result = await db()
    .from('home_ads')
    .select('id, image_src, target_kind, target_ref, sort_order')
    .order('sort_order');
  fail(result.error);
  return (result.data ?? []).map((row) => {
    const ref = row.target_ref ?? '';
    const kind = targetKind.parse(row.target_kind);
    return {
      id: row.id,
      image: row.image_src,
      targetKind: ref ? kind : 'none',
      targetRef: ref && kind !== 'none' ? ref : '',
    };
  });
}

export async function replaceHomeAds(ads: HomeAd[]): Promise<void> {
  const client = db();
  const existing = await client.from('home_ads').select('id');
  fail(existing.error);
  const keep = new Set(ads.map((ad) => ad.id));
  const remove = (existing.data ?? []).map((row) => row.id).filter((id) => !keep.has(id));
  if (remove.length > 0) {
    fail((await client.from('home_ads').delete().in('id', remove)).error);
  }
  if (ads.length === 0) return;
  fail(
    (
      await client.from('home_ads').upsert(
        ads.map((ad, index) => ({
          id: ad.id,
          image_src: ad.image,
          target_kind: ad.targetRef && ad.targetKind !== 'none' ? ad.targetKind : 'none',
          target_ref: ad.targetRef && ad.targetKind !== 'none' ? ad.targetRef : '',
          sort_order: index,
        })),
      )
    ).error,
  );
}
