import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const textSchema = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(200);
const fieldTypeSchema = z.enum(['text', 'number', 'boolean']);
const fieldSectionSchema = z.enum(['spec', 'features', 'info']);

const localized = z.object({
  he: textSchema,
  ar: textSchema,
});

const storedImage = z.string().max(2_000_000).default('');

const imageSchema = z.object({
  id: idSchema,
  src: z.string().trim().min(1).max(2_000_000),
});

const variantSchema = z.object({
  id: idSchema,
  color: z.string().trim().max(80),
  colorHex: z.string().trim().max(20),
  stock: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
  images: z.array(imageSchema).max(12),
});

const productSchema = z.object({
  id: idSchema,
  name: localized,
  priceMinor: z.number().int().min(0).max(100_000_000),
  brandId: idSchema,
  categoryId: idSchema,
  subcategoryId: z.string().max(80),
  specs: z.record(z.string().max(8_000)).refine((value) => Object.keys(value).length <= 40),
  variants: z.array(variantSchema).max(20),
});

const catalogSchema = z.object({
  categories: z
    .array(
      z.object({
        id: idSchema,
        slug: slugSchema,
        name: localized,
        image: storedImage,
        subcategories: z.array(z.object({ id: idSchema, name: localized, image: storedImage })).max(40),
        fields: z
          .array(
            z.object({
              id: idSchema,
              label: localized,
              type: fieldTypeSchema,
              section: fieldSectionSchema.default('features'),
            }),
          )
          .max(40),
      }),
    )
    .max(80),
  brands: z.array(z.object({ id: idSchema, slug: slugSchema, name: textSchema, image: storedImage })).max(80),
  products: z.array(productSchema).max(200),
  coupons: z
    .array(
      z.object({
        id: idSchema,
        code: z.string().trim().min(1).max(40),
        kind: z.enum(['percent', 'fixed']),
        value: z.number().int().positive().max(10_000_000),
        endsAt: z.string().max(40),
      }),
    )
    .max(100),
  settings: z.object({
    phone: z.string().trim().max(40),
    accent: z.string().trim().min(1).max(40),
    zones: z
      .array(
        z.object({
          id: idSchema,
          nameHe: textSchema,
          nameAr: optionalText,
          priceMinor: z.number().int().min(0).max(10_000_000),
          active: z.boolean(),
          sortOrder: z.number().int().min(0).max(10_000),
        }),
      )
      .max(40),
  }),
});

export type CatalogPayload = z.infer<typeof catalogSchema>;

type DbError = { message: string; code?: string } | null;

function db() {
  return getSupabaseAdmin();
}

function fail(error: DbError): never {
  logger.error('database error', { code: error?.code, message: error?.message });
  if (error?.code === '23505') throw new AppError(409, 'conflict', 'Already exists');
  if (error?.code === '23503') throw new AppError(409, 'in_use', 'Still in use');
  throw new AppError(500, 'database', 'Database write failed');
}

function check(error: DbError) {
  if (error) fail(error);
}

export function parseCatalog(input: unknown): CatalogPayload {
  return catalogSchema.parse(input);
}

export async function isCatalogEmpty(): Promise<boolean> {
  const [brands, categories, products] = await Promise.all([
    db().from('brands').select('id', { count: 'exact', head: true }),
    db().from('categories').select('id', { count: 'exact', head: true }),
    db().from('products').select('id', { count: 'exact', head: true }),
  ]);
  check(brands.error);
  check(categories.error);
  check(products.error);
  return (brands.count ?? 0) === 0 && (categories.count ?? 0) === 0 && (products.count ?? 0) === 0;
}

export async function readCatalog(): Promise<CatalogPayload> {
  const client = db();
  const [categories, subcategories, fields, brands, products, specs, variants, images, coupons, settings, zones] =
    await Promise.all([
      client.from('categories').select('id, slug, name_he, name_ar, image_src, sort_order').order('sort_order'),
      client.from('subcategories').select('id, category_id, name_he, name_ar, image_src, sort_order').order('sort_order'),
      client.from('category_fields').select('id, category_id, label_he, label_ar, field_type, section, sort_order').order('sort_order'),
      client.from('brands').select('id, slug, name, image_src, sort_order').order('sort_order'),
      client.from('products').select('id, name_he, name_ar, price_minor, brand_id, category_id, subcategory_id, sort_order').order('sort_order'),
      client.from('product_specs').select('product_id, field_id, value'),
      client.from('product_variants').select('id, product_id, color, color_hex, stock, is_active, sort_order').order('sort_order'),
      client.from('variant_images').select('id, variant_id, src, sort_order').order('sort_order'),
      client.from('coupons').select('id, code, kind, value, ends_at, sort_order').order('sort_order'),
      client.from('store_settings').select('phone, accent').eq('id', true).maybeSingle(),
      client.from('shipping_zones').select('id, name, name_ar, price_minor, is_active, sort_order').order('sort_order'),
    ]);

  for (const result of [categories, subcategories, fields, brands, products, specs, variants, images, coupons, settings, zones]) {
    check(result.error);
  }

  const subsByCategory = group(subcategories.data ?? [], (row) => row.category_id);
  const fieldsByCategory = group(fields.data ?? [], (row) => row.category_id);
  const specsByProduct = group(specs.data ?? [], (row) => row.product_id);
  const imagesByVariant = group(images.data ?? [], (row) => row.variant_id);
  const variantsByProduct = group(variants.data ?? [], (row) => row.product_id);

  return {
    categories: (categories.data ?? []).map((category) => ({
      id: category.id,
      slug: category.slug,
      name: { he: category.name_he, ar: category.name_ar },
      image: category.image_src ?? '',
      subcategories: (subsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        name: { he: item.name_he, ar: item.name_ar },
        image: item.image_src ?? '',
      })),
      fields: (fieldsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        label: { he: item.label_he, ar: item.label_ar },
        type: item.field_type as 'text' | 'number' | 'boolean',
        section: item.section === 'spec' || item.section === 'info' ? item.section : 'features',
      })),
    })),
    brands: (brands.data ?? []).map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: brand.image_src ?? '',
    })),
    products: (products.data ?? []).map((product) => ({
      id: product.id,
      name: { he: product.name_he, ar: product.name_ar },
      priceMinor: product.price_minor,
      brandId: product.brand_id,
      categoryId: product.category_id,
      subcategoryId: product.subcategory_id ?? '',
      specs: Object.fromEntries((specsByProduct.get(product.id) ?? []).map((item) => [item.field_id, item.value])),
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        color: variant.color,
        colorHex: variant.color_hex,
        stock: variant.stock,
        active: variant.is_active,
        images: (imagesByVariant.get(variant.id) ?? []).map((image) => ({ id: image.id, src: image.src })),
      })),
    })),
    coupons: (coupons.data ?? []).map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind as 'percent' | 'fixed',
      value: coupon.value,
      endsAt: coupon.ends_at,
    })),
    settings: {
      phone: settings.data?.phone ?? '',
      accent: settings.data?.accent || 'burgundy',
      zones: (zones.data ?? []).map((zone) => ({
        id: zone.id,
        nameHe: zone.name,
        nameAr: zone.name_ar ?? '',
        priceMinor: zone.price_minor,
        active: zone.is_active,
        sortOrder: zone.sort_order,
      })),
    },
  };
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

export async function importCatalog(input: CatalogPayload): Promise<CatalogPayload> {
  if (!(await isCatalogEmpty())) return readCatalog();

  const client = db();
  if (input.brands.length > 0) {
    const { error } = await client.from('brands').insert(
      input.brands.map((brand, index) => ({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        image_src: brand.image,
        sort_order: index,
      })),
    );
    check(error);
  }

  if (input.categories.length > 0) {
    const { error } = await client.from('categories').insert(
      input.categories.map((category, index) => ({
        id: category.id,
        slug: category.slug,
        name_he: category.name.he,
        name_ar: category.name.ar,
        image_src: category.image,
        sort_order: index,
      })),
    );
    check(error);
  }

  const subcategories = input.categories.flatMap((category) =>
    category.subcategories.map((item, index) => ({
      id: item.id,
      category_id: category.id,
      name_he: item.name.he,
      name_ar: item.name.ar,
      image_src: item.image,
      sort_order: index,
    })),
  );
  if (subcategories.length > 0) check((await client.from('subcategories').insert(subcategories)).error);

  const fields = input.categories.flatMap((category) =>
    category.fields.map((item, index) => ({
      id: item.id,
      category_id: category.id,
      label_he: item.label.he,
      label_ar: item.label.ar,
      field_type: item.type,
      section: item.section,
      sort_order: index,
    })),
  );
  if (fields.length > 0) check((await client.from('category_fields').insert(fields)).error);

  if (input.products.length > 0) {
    check(
      (
        await client.from('products').insert(
          input.products.map((product, index) => ({
            id: product.id,
            name_he: product.name.he,
            name_ar: product.name.ar,
            price_minor: product.priceMinor,
            brand_id: product.brandId,
            category_id: product.categoryId,
            subcategory_id: product.subcategoryId || null,
            sort_order: index,
          })),
        )
      ).error,
    );
  }

  const variants = input.products.flatMap((product) =>
    product.variants.map((variant, index) => ({
      id: variant.id,
      product_id: product.id,
      color: variant.color,
      color_hex: variant.colorHex || '#172033',
      stock: variant.stock,
      is_active: variant.active,
      sort_order: index,
    })),
  );
  if (variants.length > 0) check((await client.from('product_variants').insert(variants)).error);

  const images = input.products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      variant.images.map((image, index) => ({
        id: image.id,
        variant_id: variant.id,
        src: image.src,
        sort_order: index,
      })),
    ),
  );
  if (images.length > 0) check((await client.from('variant_images').insert(images)).error);

  const specs = input.products.flatMap((product) =>
    Object.entries(product.specs)
      .filter(([, value]) => value.trim())
      .map(([fieldId, value]) => ({ product_id: product.id, field_id: fieldId, value })),
  );
  if (specs.length > 0) check((await client.from('product_specs').insert(specs)).error);

  if (input.coupons.length > 0) {
    check(
      (
        await client.from('coupons').insert(
          input.coupons.map((coupon, index) => ({
            id: coupon.id,
            code: coupon.code,
            kind: coupon.kind,
            value: coupon.value,
            ends_at: coupon.endsAt,
            sort_order: index,
          })),
        )
      ).error,
    );
  }

  await writeSettings(input.settings);
  return readCatalog();
}

async function nextSort(table: 'categories' | 'brands' | 'products' | 'coupons'): Promise<number> {
  const { data, error } = await db().from(table).select('sort_order').order('sort_order', { ascending: true }).limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? 0) - 1;
}

async function nextChildSort(table: 'subcategories' | 'category_fields', categoryId: string): Promise<number> {
  const { data, error } = await db()
    .from(table)
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export const categoryInput = z.object({
  id: idSchema,
  slug: slugSchema,
  nameHe: textSchema,
  nameAr: optionalText,
  image: storedImage,
});

export async function createCategory(input: z.infer<typeof categoryInput>) {
  const nameAr = input.nameAr || input.nameHe;
  const { error } = await db().from('categories').insert({
    id: input.id,
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: nameAr,
    image_src: input.image,
    sort_order: await nextSort('categories'),
  });
  check(error);
}

export async function updateCategory(id: string, input: Omit<z.infer<typeof categoryInput>, 'id'>) {
  const { error } = await db()
    .from('categories')
    .update({
      slug: input.slug,
      name_he: input.nameHe,
      name_ar: input.nameAr || input.nameHe,
      image_src: input.image,
    })
    .eq('id', id);
  check(error);
}

export async function deleteCategory(id: string) {
  const used = await db().from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
  check(used.error);
  if ((used.count ?? 0) > 0) throw new AppError(409, 'in_use', 'Category still has products');
  const { error } = await db().from('categories').delete().eq('id', id);
  check(error);
}

export const namedInput = z.object({
  id: idSchema,
  nameHe: textSchema,
  nameAr: optionalText,
});

export const subcategoryInput = namedInput.extend({
  image: storedImage,
});

export async function createSubcategory(categoryId: string, input: z.infer<typeof subcategoryInput>) {
  const { error } = await db().from('subcategories').insert({
    id: input.id,
    category_id: categoryId,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image,
    sort_order: await nextChildSort('subcategories', categoryId),
  });
  check(error);
}

export async function updateSubcategory(id: string, input: Omit<z.infer<typeof subcategoryInput>, 'id'>) {
  const { error } = await db()
    .from('subcategories')
    .update({
      name_he: input.nameHe,
      name_ar: input.nameAr || input.nameHe,
      image_src: input.image,
    })
    .eq('id', id);
  check(error);
}

export async function deleteSubcategory(id: string) {
  const { error } = await db().from('subcategories').delete().eq('id', id);
  check(error);
}

export const fieldInput = namedInput.extend({
  type: fieldTypeSchema,
  section: fieldSectionSchema.default('features'),
});

export async function createField(categoryId: string, input: z.infer<typeof fieldInput>) {
  const { error } = await db().from('category_fields').insert({
    id: input.id,
    category_id: categoryId,
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section,
    sort_order: await nextChildSort('category_fields', categoryId),
  });
  check(error);
}

export async function updateField(id: string, input: Omit<z.infer<typeof fieldInput>, 'id'>) {
  const { error } = await db()
    .from('category_fields')
    .update({
      label_he: input.nameHe,
      label_ar: input.nameAr || input.nameHe,
      field_type: input.type,
      section: input.section,
    })
    .eq('id', id);
  check(error);
}

export async function deleteField(id: string) {
  const { error } = await db().from('category_fields').delete().eq('id', id);
  check(error);
}

export const brandInput = z.object({
  id: idSchema,
  name: textSchema,
  slug: slugSchema,
  image: storedImage,
});

export async function createBrand(input: z.infer<typeof brandInput>) {
  const { error } = await db().from('brands').insert({
    id: input.id,
    name: input.name,
    slug: input.slug,
    image_src: input.image,
    sort_order: await nextSort('brands'),
  });
  check(error);
}

export async function updateBrand(id: string, input: Omit<z.infer<typeof brandInput>, 'id'>) {
  const { error } = await db()
    .from('brands')
    .update({ name: input.name, slug: input.slug, image_src: input.image })
    .eq('id', id);
  check(error);
}

export async function deleteBrand(id: string) {
  const used = await db().from('products').select('id', { count: 'exact', head: true }).eq('brand_id', id);
  check(used.error);
  if ((used.count ?? 0) > 0) throw new AppError(409, 'in_use', 'Brand still has products');
  const { error } = await db().from('brands').delete().eq('id', id);
  check(error);
}

export async function saveProduct(input: z.infer<typeof productSchema>) {
  const client = db();
  const existing = await client.from('products').select('sort_order').eq('id', input.id).maybeSingle();
  check(existing.error);
  const row = {
    id: input.id,
    name_he: input.name.he,
    name_ar: input.name.ar,
    price_minor: input.priceMinor,
    brand_id: input.brandId,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId || null,
    sort_order: existing.data?.sort_order ?? (await nextSort('products')),
  };
  check((await client.from('products').upsert(row)).error);
  check((await client.from('product_specs').delete().eq('product_id', input.id)).error);
  check((await client.from('product_variants').delete().eq('product_id', input.id)).error);

  if (input.variants.length > 0) {
    check(
      (
        await client.from('product_variants').insert(
          input.variants.map((variant, index) => ({
            id: variant.id,
            product_id: input.id,
            color: variant.color,
            color_hex: variant.colorHex || '#172033',
            stock: variant.stock,
            is_active: variant.active,
            sort_order: index,
          })),
        )
      ).error,
    );
  }

  const images = input.variants.flatMap((variant) =>
    variant.images.map((image, index) => ({
      id: image.id,
      variant_id: variant.id,
      src: image.src,
      sort_order: index,
    })),
  );
  if (images.length > 0) check((await client.from('variant_images').insert(images)).error);

  const specs = Object.entries(input.specs)
    .filter(([, value]) => value.trim())
    .map(([fieldId, value]) => ({ product_id: input.id, field_id: fieldId, value }));
  if (specs.length > 0) check((await client.from('product_specs').insert(specs)).error);
}

export async function deleteProduct(id: string) {
  const { error } = await db().from('products').delete().eq('id', id);
  check(error);
}

export const couponInput = z.object({
  id: idSchema,
  code: z.string().trim().min(1).max(40),
  kind: z.enum(['percent', 'fixed']),
  value: z.number().int().positive().max(10_000_000),
  endsAt: z.string().max(40),
});

export async function saveCoupon(input: z.infer<typeof couponInput>) {
  const existing = await db().from('coupons').select('sort_order').eq('id', input.id).maybeSingle();
  check(existing.error);
  const { error } = await db().from('coupons').upsert({
    id: input.id,
    code: input.code.toUpperCase(),
    kind: input.kind,
    value: input.value,
    ends_at: input.endsAt,
    sort_order: existing.data?.sort_order ?? (await nextSort('coupons')),
  });
  check(error);
}

export async function deleteCoupon(id: string) {
  const { error } = await db().from('coupons').delete().eq('id', id);
  check(error);
}

const settingsInput = z.object({
  phone: z.string().trim().max(40),
  accent: z.string().trim().min(1).max(40),
  zones: catalogSchema.shape.settings.shape.zones,
});

export async function writeSettings(input: z.infer<typeof settingsInput>) {
  const client = db();
  check(
    (
      await client.from('store_settings').upsert({
        id: true,
        phone: input.phone,
        accent: input.accent,
      })
    ).error,
  );

  if (input.zones.length === 0) {
    check((await client.from('shipping_zones').delete().neq('id', '')).error);
    return;
  }

  check(
    (
      await client.from('shipping_zones').upsert(
        input.zones.map((zone) => ({
          id: zone.id,
          name: zone.nameHe,
          name_ar: zone.nameAr,
          price_minor: zone.priceMinor,
          is_active: zone.active,
          sort_order: zone.sortOrder,
        })),
      )
    ).error,
  );
  check(
    (await client.from('shipping_zones').delete().not('id', 'in', `(${input.zones.map((zone) => `"${zone.id}"`).join(',')})`)).error,
  );
}

export { idSchema, productSchema, settingsInput };
