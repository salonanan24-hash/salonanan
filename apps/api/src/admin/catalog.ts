import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { persistImage } from '../lib/media.js';
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

const couponScopeSchema = z.enum(['site', 'category', 'subcategory', 'products', 'brand']);

export const couponInput = z
  .object({
    id: idSchema,
    code: z.string().trim().min(1).max(40),
    kind: z.enum(['percent', 'fixed']),
    value: z.number().int().positive().max(10_000_000),
    endsAt: z.string().max(40),
    scope: couponScopeSchema.default('site'),
    categoryId: z.string().trim().max(80).default(''),
    subcategoryId: z.string().trim().max(80).default(''),
    brandId: z.string().trim().max(80).default(''),
    productIds: z.array(idSchema).max(200).default([]),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.scope === 'category' && !coupon.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category' });
    }
    if (coupon.scope === 'subcategory' && !coupon.subcategoryId) {
      ctx.addIssue({ code: 'custom', path: ['subcategoryId'], message: 'Choose a subcategory' });
    }
    if (coupon.scope === 'brand' && !coupon.brandId) {
      ctx.addIssue({ code: 'custom', path: ['brandId'], message: 'Choose a brand' });
    }
    if (coupon.scope === 'products' && coupon.productIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Choose a product' });
    }
  });

const specMap = z.record(z.string().max(20_000)).refine((value) => Object.keys(value).length <= 80);

const variantSchema = z.object({
  id: idSchema,
  color: z.string().trim().max(80),
  colorHex: z.string().trim().max(20),
  sku: z.string().trim().max(80).default(''),
  priceMinor: z.number().int().min(0).max(100_000_000).nullable().default(null),
  subcategoryId: z.string().max(80).default(''),
  specs: specMap.default({}),
  specsAr: specMap.default({}),
  stock: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
  onSale: z.boolean().default(false),
  inPackages: z.boolean().default(false),
  images: z.array(imageSchema).max(12),
});

const fieldSchema = z.object({
  id: idSchema,
  label: localized,
  type: fieldTypeSchema,
  section: fieldSectionSchema.default('features'),
});

const productSchema = z.object({
  id: idSchema,
  name: localized,
  priceMinor: z.number().int().min(0).max(100_000_000),
  brandId: idSchema,
  categoryId: idSchema,
  subcategoryId: z.string().max(80),
  fields: z.array(fieldSchema).max(80).default([]),
  specs: specMap,
  specsAr: z.record(z.string().max(20_000)).default({}),
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
        displayOrder: z.number().int().min(0).max(9_999).nullable().default(null),
        subcategories: z
          .array(
            z.object({
              id: idSchema,
              name: localized,
              image: storedImage,
              displayOrder: z.number().int().min(0).max(9_999).nullable().default(null),
            }),
          )
          .max(40),
        fields: z.array(fieldSchema).max(80).default([]),
      }),
    )
    .max(80),
  brands: z.array(z.object({ id: idSchema, slug: slugSchema, name: textSchema, image: storedImage })).max(80),
  products: z.array(productSchema).max(200),
  coupons: z.array(couponInput).max(100),
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

/** Supabase caps a single select at 1000 rows — page until everything is loaded. */
async function fetchAll<T extends Record<string, unknown>>(
  table: string,
  columns: string,
  orderBy?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const client = db();
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = client.from(table).select(columns).range(from, from + pageSize - 1);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await query;
    check(error);
    const chunk = (data ?? []) as unknown as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
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
  const [
    categories,
    subcategories,
    fields,
    brands,
    products,
    specs,
    variants,
    variantSpecs,
    images,
    coupons,
    couponProducts,
    settings,
    zones,
  ] = await Promise.all([
    fetchAll<{
      id: string;
      slug: string;
      name_he: string;
      name_ar: string;
      image_src: string | null;
      sort_order: number;
      display_order: number | null;
    }>('categories', 'id, slug, name_he, name_ar, image_src, sort_order, display_order', { column: 'sort_order' }),
    fetchAll<{
      id: string;
      category_id: string;
      name_he: string;
      name_ar: string;
      image_src: string | null;
      sort_order: number;
      display_order: number | null;
    }>('subcategories', 'id, category_id, name_he, name_ar, image_src, sort_order, display_order', {
      column: 'sort_order',
    }),
    fetchAll<{
      id: string;
      product_id: string;
      label_he: string;
      label_ar: string;
      field_type: string;
      section: string | null;
      sort_order: number;
    }>('product_fields', 'id, product_id, label_he, label_ar, field_type, section, sort_order', { column: 'sort_order' }),
    fetchAll<{ id: string; slug: string; name: string; image_src: string | null; sort_order: number }>(
      'brands',
      'id, slug, name, image_src, sort_order',
      { column: 'sort_order' },
    ),
    fetchAll<{
      id: string;
      name_he: string;
      name_ar: string;
      price_minor: number;
      brand_id: string;
      category_id: string;
      subcategory_id: string | null;
      sort_order: number;
    }>('products', 'id, name_he, name_ar, price_minor, brand_id, category_id, subcategory_id, sort_order', {
      column: 'sort_order',
    }),
    fetchAll<{ product_id: string; field_id: string; value: string; value_ar: string | null }>(
      'product_specs',
      'product_id, field_id, value, value_ar',
    ),
    fetchAll<{
      id: string;
      product_id: string;
      color: string;
      color_hex: string;
      sku: string | null;
      price_minor: number | null;
      subcategory_id: string | null;
      stock: number;
      is_active: boolean;
      on_sale: boolean;
      in_packages: boolean;
      sort_order: number;
    }>(
      'product_variants',
      'id, product_id, color, color_hex, sku, price_minor, subcategory_id, stock, is_active, on_sale, in_packages, sort_order',
      { column: 'sort_order' },
    ),
    fetchAll<{ variant_id: string; field_id: string; value: string; value_ar: string | null }>(
      'variant_specs',
      'variant_id, field_id, value, value_ar',
    ),
    fetchAll<{ id: string; variant_id: string; src: string; sort_order: number }>(
      'variant_images',
      'id, variant_id, src, sort_order',
      { column: 'sort_order' },
    ),
    fetchAll<{
      id: string;
      code: string;
      kind: string;
      value: number;
      ends_at: string | null;
      scope: string | null;
      category_id: string | null;
      subcategory_id: string | null;
      brand_id: string | null;
      sort_order: number;
    }>('coupons', 'id, code, kind, value, ends_at, scope, category_id, subcategory_id, brand_id, sort_order', {
      column: 'sort_order',
    }),
    fetchAll<{ coupon_id: string; product_id: string }>('coupon_products', 'coupon_id, product_id'),
    client.from('store_settings').select('phone, accent').eq('id', true).maybeSingle(),
    fetchAll<{
      id: string;
      name: string;
      name_ar: string | null;
      price_minor: number;
      is_active: boolean;
      sort_order: number;
    }>('shipping_zones', 'id, name, name_ar, price_minor, is_active, sort_order', { column: 'sort_order' }),
  ]);

  check(settings.error);

  const subsByCategory = group(subcategories, (row) => row.category_id);
  const fieldsByProduct = group(fields, (row) => row.product_id);
  const specsByProduct = group(specs, (row) => row.product_id);
  const imagesByVariant = group(images, (row) => row.variant_id);
  const specsByVariant = group(variantSpecs, (row) => row.variant_id);
  const variantsByProduct = group(variants, (row) => row.product_id);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: { he: category.name_he, ar: category.name_ar },
      image: category.image_src ?? '',
      displayOrder: category.display_order,
      subcategories: (subsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        name: { he: item.name_he, ar: item.name_ar },
        image: item.image_src ?? '',
        displayOrder: item.display_order,
      })),
      fields: [],
    })),
    brands: brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: brand.image_src ?? '',
    })),
    products: products.map((product) => ({
      id: product.id,
      name: { he: product.name_he, ar: product.name_ar },
      priceMinor: product.price_minor,
      brandId: product.brand_id,
      categoryId: product.category_id,
      subcategoryId: product.subcategory_id ?? '',
      fields: (fieldsByProduct.get(product.id) ?? []).map((item) => ({
        id: item.id,
        label: { he: item.label_he, ar: item.label_ar },
        type: item.field_type as 'text' | 'number' | 'boolean',
        section: item.section === 'spec' || item.section === 'info' ? item.section : 'features',
      })),
      specs: Object.fromEntries((specsByProduct.get(product.id) ?? []).map((item) => [item.field_id, item.value])),
      specsAr: Object.fromEntries(
        (specsByProduct.get(product.id) ?? [])
          .filter((item) => (item.value_ar ?? '').trim())
          .map((item) => [item.field_id, item.value_ar ?? '']),
      ),
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        color: variant.color,
        colorHex: variant.color_hex,
        sku: variant.sku ?? '',
        priceMinor: variant.price_minor,
        subcategoryId: variant.subcategory_id ?? '',
        specs: Object.fromEntries((specsByVariant.get(variant.id) ?? []).map((item) => [item.field_id, item.value])),
        specsAr: Object.fromEntries(
          (specsByVariant.get(variant.id) ?? [])
            .filter((item) => (item.value_ar ?? '').trim())
            .map((item) => [item.field_id, item.value_ar ?? '']),
        ),
        stock: variant.stock,
        active: variant.is_active,
        onSale: variant.on_sale,
        inPackages: variant.in_packages,
        images: (imagesByVariant.get(variant.id) ?? []).map((image) => ({ id: image.id, src: image.src })),
      })),
    })),
    coupons: coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind as 'percent' | 'fixed',
      value: coupon.value,
      endsAt: coupon.ends_at ?? '',
      scope: (coupon.scope ?? 'site') as 'site' | 'category' | 'subcategory' | 'products' | 'brand',
      categoryId: coupon.category_id ?? '',
      subcategoryId: coupon.subcategory_id ?? '',
      brandId: coupon.brand_id ?? '',
      productIds: couponProducts.filter((row) => row.coupon_id === coupon.id).map((row) => row.product_id),
    })),
    settings: {
      phone: settings.data?.phone ?? '',
      accent: settings.data?.accent || 'burgundy',
      zones: zones.map((zone) => ({
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
    const brands = [];
    for (const [index, brand] of input.brands.entries()) {
      brands.push({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        image_src: await persistImage(brand.image, 'brands', brand.id),
        sort_order: index,
      });
    }
    check((await client.from('brands').insert(brands)).error);
  }

  if (input.categories.length > 0) {
    const categories = [];
    for (const [index, category] of input.categories.entries()) {
      categories.push({
        id: category.id,
        slug: category.slug,
        name_he: category.name.he,
        name_ar: category.name.ar,
        image_src: await persistImage(category.image, 'categories', category.id),
        sort_order: index,
      });
    }
    check((await client.from('categories').insert(categories)).error);
  }

  const subcategories = [];
  for (const category of input.categories) {
    for (const [index, item] of category.subcategories.entries()) {
      subcategories.push({
        id: item.id,
        category_id: category.id,
        name_he: item.name.he,
        name_ar: item.name.ar,
        image_src: await persistImage(item.image, 'subcategories', item.id),
        sort_order: index,
        display_order: item.displayOrder ?? null,
      });
    }
  }
  if (subcategories.length > 0) check((await client.from('subcategories').insert(subcategories)).error);

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

  const fields = input.products.flatMap((product) =>
    product.fields.map((item, index) => ({
      id: item.id,
      product_id: product.id,
      label_he: item.label.he,
      label_ar: item.label.ar,
      field_type: item.type,
      section: item.section,
      sort_order: index,
    })),
  );
  if (fields.length > 0) check((await client.from('product_fields').insert(fields)).error);

  const variants = input.products.flatMap((product) =>
    product.variants.map((variant, index) => ({
      id: variant.id,
      product_id: product.id,
      color: variant.color,
      color_hex: variant.colorHex || '#172033',
      stock: variant.stock,
      is_active: variant.active,
      on_sale: variant.onSale,
      in_packages: variant.inPackages,
      sort_order: index,
    })),
  );
  if (variants.length > 0) check((await client.from('product_variants').insert(variants)).error);

  const images = [];
  for (const product of input.products) {
    for (const variant of product.variants) {
      for (const [index, image] of variant.images.entries()) {
        images.push({
          id: image.id,
          variant_id: variant.id,
          src: await persistImage(image.src, `products/${product.id}`, image.id),
          sort_order: index,
        });
      }
    }
  }
  if (images.length > 0) check((await client.from('variant_images').insert(images)).error);

  const specs = input.products.flatMap((product) =>
    Object.entries(product.specs)
      .filter(([, value]) => value.trim())
      .map(([fieldId, value]) => ({
        product_id: product.id,
        field_id: fieldId,
        value,
        value_ar: product.specsAr[fieldId] ?? '',
      })),
  );
  if (specs.length > 0) check((await client.from('product_specs').insert(specs)).error);

  if (input.coupons.length > 0) {
    check(
      (
        await client.from('coupons').insert(input.coupons.map((coupon, index) => couponRow(coupon, index)))
      ).error,
    );
    const links = input.coupons.flatMap((coupon) =>
      coupon.scope === 'products' ? coupon.productIds.map((productId) => ({ coupon_id: coupon.id, product_id: productId })) : [],
    );
    if (links.length > 0) check((await client.from('coupon_products').insert(links)).error);
  }

  await writeSettings(input.settings);
  return readCatalog();
}

async function nextSort(table: 'categories' | 'brands' | 'products' | 'coupons'): Promise<number> {
  const { data, error } = await db().from(table).select('sort_order').order('sort_order', { ascending: true }).limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? 0) - 1;
}

async function nextChildSort(table: 'subcategories', categoryId: string): Promise<number> {
  const { data, error } = await db()
    .from(table)
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

async function nextProductFieldSort(productId: string): Promise<number> {
  const { data, error } = await db()
    .from('product_fields')
    .select('sort_order')
    .eq('product_id', productId)
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
  displayOrder: z.number().int().min(0).max(9_999).nullable().optional(),
});

export async function createCategory(input: z.infer<typeof categoryInput>) {
  const nameAr = input.nameAr || input.nameHe;
  const image = await persistImage(input.image, 'categories', input.id);
  const { error } = await db().from('categories').insert({
    id: input.id,
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: nameAr,
    image_src: image,
    sort_order: await nextSort('categories'),
    display_order: input.displayOrder ?? null,
  });
  check(error);
}

export async function updateCategory(id: string, input: Omit<z.infer<typeof categoryInput>, 'id'>) {
  const image = await persistImage(input.image, 'categories', id);
  const { error } = await db()
    .from('categories')
    .update({
      slug: input.slug,
      name_he: input.nameHe,
      name_ar: input.nameAr || input.nameHe,
      image_src: image,
      display_order: input.displayOrder ?? null,
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
  displayOrder: z.number().int().min(0).max(9_999).nullable().optional(),
});

export async function createSubcategory(categoryId: string, input: z.infer<typeof subcategoryInput>) {
  const image = await persistImage(input.image, 'subcategories', input.id);
  const { error } = await db().from('subcategories').insert({
    id: input.id,
    category_id: categoryId,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: image,
    sort_order: await nextChildSort('subcategories', categoryId),
    display_order: input.displayOrder ?? null,
  });
  check(error);
}

export async function updateSubcategory(id: string, input: Omit<z.infer<typeof subcategoryInput>, 'id'>) {
  const image = await persistImage(input.image, 'subcategories', id);
  const { error } = await db()
    .from('subcategories')
    .update({
      name_he: input.nameHe,
      name_ar: input.nameAr || input.nameHe,
      image_src: image,
      display_order: input.displayOrder ?? null,
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

export async function createField(productId: string, input: z.infer<typeof fieldInput>) {
  const { error } = await db().from('product_fields').insert({
    id: input.id,
    product_id: productId,
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section,
    sort_order: await nextProductFieldSort(productId),
  });
  check(error);
}

export async function updateField(id: string, input: Omit<z.infer<typeof fieldInput>, 'id'>) {
  const { error } = await db()
    .from('product_fields')
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
  const { error } = await db().from('product_fields').delete().eq('id', id);
  check(error);
}

export const brandInput = z.object({
  id: idSchema,
  name: textSchema,
  slug: slugSchema,
  image: storedImage,
});

export async function createBrand(input: z.infer<typeof brandInput>) {
  const image = await persistImage(input.image, 'brands', input.id);
  const { error } = await db().from('brands').insert({
    id: input.id,
    name: input.name,
    slug: input.slug,
    image_src: image,
    sort_order: await nextSort('brands'),
  });
  check(error);
}

export async function updateBrand(id: string, input: Omit<z.infer<typeof brandInput>, 'id'>) {
  const image = await persistImage(input.image, 'brands', id);
  const { error } = await db()
    .from('brands')
    .update({ name: input.name, slug: input.slug, image_src: image })
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
  check((await client.from('product_fields').delete().eq('product_id', input.id)).error);

  if (input.fields.length > 0) {
    check(
      (
        await client.from('product_fields').insert(
          input.fields.map((field, index) => ({
            id: field.id,
            product_id: input.id,
            label_he: field.label.he,
            label_ar: field.label.ar,
            field_type: field.type,
            section: field.section,
            sort_order: index,
          })),
        )
      ).error,
    );
  }

  if (input.variants.length > 0) {
    check(
      (
        await client.from('product_variants').insert(
          input.variants.map((variant, index) => ({
            id: variant.id,
            product_id: input.id,
            color: variant.color,
            color_hex: variant.colorHex || '#172033',
            sku: variant.sku,
            price_minor: variant.priceMinor,
            subcategory_id: variant.subcategoryId || null,
            stock: variant.stock,
            is_active: variant.active,
            on_sale: variant.onSale,
            in_packages: variant.inPackages,
            sort_order: index,
          })),
        )
      ).error,
    );
  }

  const images = [];
  for (const variant of input.variants) {
    for (const [index, image] of variant.images.entries()) {
      images.push({
        id: image.id,
        variant_id: variant.id,
        src: await persistImage(image.src, `products/${input.id}`, image.id),
        sort_order: index,
      });
    }
  }
  if (images.length > 0) check((await client.from('variant_images').insert(images)).error);

  const specs = Object.entries(input.specs)
    .filter(([, value]) => value.trim())
    .map(([fieldId, value]) => ({
      product_id: input.id,
      field_id: fieldId,
      value,
      value_ar: input.specsAr[fieldId] ?? '',
    }));
  if (specs.length > 0) check((await client.from('product_specs').insert(specs)).error);

  const variantSpecRows = input.variants.flatMap((variant) =>
    Object.entries(variant.specs)
      .filter(([, value]) => value.trim())
      .map(([fieldId, value]) => ({
        variant_id: variant.id,
        field_id: fieldId,
        value,
        value_ar: variant.specsAr[fieldId] ?? '',
      })),
  );
  if (variantSpecRows.length > 0) check((await client.from('variant_specs').insert(variantSpecRows)).error);
}

export async function deleteProduct(id: string) {
  const { error } = await db().from('products').delete().eq('id', id);
  check(error);
}

function couponRow(coupon: z.infer<typeof couponInput>, sortOrder: number) {
  return {
    id: coupon.id,
    code: coupon.code.toUpperCase(),
    kind: coupon.kind,
    value: coupon.value,
    ends_at: coupon.endsAt,
    scope: coupon.scope,
    category_id: coupon.scope === 'category' || coupon.scope === 'subcategory' ? coupon.categoryId || null : null,
    subcategory_id: coupon.scope === 'subcategory' ? coupon.subcategoryId || null : null,
    brand_id: coupon.scope === 'brand' ? coupon.brandId || null : null,
    sort_order: sortOrder,
  };
}

export async function saveCoupon(input: z.infer<typeof couponInput>) {
  const existing = await db().from('coupons').select('sort_order').eq('id', input.id).maybeSingle();
  check(existing.error);
  const { error } = await db().from('coupons').upsert(couponRow(input, existing.data?.sort_order ?? (await nextSort('coupons'))));
  check(error);
  const cleared = await db().from('coupon_products').delete().eq('coupon_id', input.id);
  check(cleared.error);
  if (input.scope === 'products' && input.productIds.length > 0) {
    const linked = await db().from('coupon_products').insert(
      input.productIds.map((productId) => ({ coupon_id: input.id, product_id: productId })),
    );
    check(linked.error);
  }
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
