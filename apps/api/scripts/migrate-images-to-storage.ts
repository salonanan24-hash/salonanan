/**
 * One-time: move base64 image_src values from DB into the public media bucket.
 * Run from repo root after the media storage migration:
 *   pnpm --filter @anan/api exec tsx scripts/migrate-images-to-storage.ts
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { persistImage } from '../src/lib/media.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../src/lib/supabase.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), 'apps/api/.env') });

const DATA = /^data:image\//i;

async function migrateTable(
  table: string,
  idColumn: string,
  imageColumn: string,
  folder: string,
  mobileColumn?: string,
) {
  const client = getSupabaseAdmin();
  const select = mobileColumn ? `${idColumn}, ${imageColumn}, ${mobileColumn}` : `${idColumn}, ${imageColumn}`;
  const { data, error } = await client.from(table).select(select);
  if (error) throw error;
  let changed = 0;
  for (const row of data ?? []) {
    const id = String((row as Record<string, unknown>)[idColumn] ?? '');
    const image = String((row as Record<string, unknown>)[imageColumn] ?? '');
    const patch: Record<string, string> = {};
    if (DATA.test(image)) {
      patch[imageColumn] = await persistImage(image, folder, id);
      changed += 1;
    }
    if (mobileColumn) {
      const mobile = String((row as Record<string, unknown>)[mobileColumn] ?? '');
      if (DATA.test(mobile)) {
        patch[mobileColumn] = await persistImage(mobile, folder, `${id}-mobile`);
        changed += 1;
      }
    }
    if (Object.keys(patch).length === 0) continue;
    const { error: updateError } = await client.from(table).update(patch).eq(idColumn, id);
    if (updateError) throw updateError;
    console.log(`${table}/${id}`);
  }
  return changed;
}

async function migrateVariantImages() {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from('variant_images').select('id, variant_id, src');
  if (error) throw error;
  let changed = 0;
  for (const row of data ?? []) {
    if (!DATA.test(row.src ?? '')) continue;
    const src = await persistImage(row.src, `products/${row.variant_id}`, row.id);
    const { error: updateError } = await client.from('variant_images').update({ src }).eq('id', row.id);
    if (updateError) throw updateError;
    changed += 1;
    console.log(`variant_images/${row.id}`);
  }
  return changed;
}

async function main() {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  let total = 0;
  // Folder must not be named "ads" — common ad blockers hide /ads/ URLs.
  total += await migrateTable('home_ads', 'id', 'image_src', 'banners', 'image_mobile_src');
  total += await migrateTable('brands', 'id', 'image_src', 'brands');
  total += await migrateTable('categories', 'id', 'image_src', 'categories');
  total += await migrateTable('subcategories', 'id', 'image_src', 'subcategories');
  total += await migrateVariantImages();
  console.log(`done: ${total} images`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
