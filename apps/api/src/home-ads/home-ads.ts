import { z } from 'zod';
import { idSchema } from '../admin/catalog.js';
import { AppError } from '../errors/app-error.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';

const targetKind = z.enum(['none', 'category', 'subcategory', 'brand', 'product', 'package']);
const placementSchema = z.enum(['hero', 'square', 'section', 'packages']);
export const sectionKeys = ['featured', 'fridges', 'laundry', 'entertainment', 'tech', 'kitchen'] as const;
const sectionSchema = z.enum(sectionKeys);
const layoutSchema = z.enum(['above', 'beside']);
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

export const homeAdsInput = z
  .object({
    ads: z
      .array(
        z.object({
          id: idSchema,
          image: imageSchema,
          targetKind,
          targetRef,
          section: sectionSchema.optional(),
          layout: layoutSchema.optional(),
        }),
      )
      .max(12),
    placement: placementSchema.default('hero'),
  })
  .superRefine((body, ctx) => {
    if (body.placement !== 'section') return;
    const seen = new Set<string>();
    body.ads.forEach((ad, index) => {
      if (!ad.section || !ad.layout) {
        ctx.addIssue({ code: 'custom', path: ['ads', index], message: 'section' });
        return;
      }
      if (seen.has(ad.section)) ctx.addIssue({ code: 'custom', path: ['ads', index, 'section'], message: 'duplicate' });
      seen.add(ad.section);
    });
  });

export type HomeAd = {
  id: string;
  image: string;
  targetKind: z.infer<typeof targetKind>;
  targetRef: string;
  section?: z.infer<typeof sectionSchema>;
  layout?: z.infer<typeof layoutSchema>;
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

export async function listHomeAds(placement: z.infer<typeof placementSchema> = 'hero'): Promise<HomeAd[]> {
  const result = await db()
    .from('home_ads')
    .select('id, image_src, target_kind, target_ref, sort_order, placement, section, layout')
    .eq('placement', placement)
    .order('sort_order');
  fail(result.error);
  return (result.data ?? []).map((row) => {
    const ref = row.target_ref ?? '';
    const kind = targetKind.parse(row.target_kind);
    const section = sectionSchema.safeParse(row.section);
    const layout = layoutSchema.safeParse(row.layout);
    return {
      id: row.id,
      image: row.image_src,
      targetKind: ref ? kind : 'none',
      targetRef: ref && kind !== 'none' ? ref : '',
      ...(section.success ? { section: section.data } : {}),
      ...(layout.success ? { layout: layout.data } : {}),
    };
  });
}

export async function replaceHomeAds(ads: HomeAd[], placement: z.infer<typeof placementSchema> = 'hero'): Promise<void> {
  const client = db();
  const existing = await client.from('home_ads').select('id').eq('placement', placement);
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
          placement,
          section: placement === 'section' ? (ad.section ?? null) : null,
          layout: placement === 'section' ? (ad.layout ?? null) : null,
          sort_order: index,
        })),
      )
    ).error,
  );
}
