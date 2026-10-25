// ../api/src/app.ts
import cors from "cors";
import express from "express";

// ../api/src/config.ts
import { z } from "zod";

// ../api/src/lib/logger.ts
function write(level, message, meta) {
  const line = JSON.stringify({
    time: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    message,
    ...meta
  });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
var logger = {
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  }
};

// ../api/src/config.ts
var envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4e3),
  NODE_ENV: z.string().default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("")
});
function readUrl(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      logger.warn("ignoring SUPABASE_URL with an unsupported protocol");
      return "";
    }
    return trimmed;
  } catch {
    logger.warn("ignoring invalid SUPABASE_URL");
    return "";
  }
}
var parsed = envSchema.parse({
  PORT: process.env.PORT ?? "4000",
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
});
var config = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0),
  supabaseUrl: readUrl(parsed.SUPABASE_URL),
  supabaseAnonKey: parsed.SUPABASE_ANON_KEY.trim(),
  supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY.trim()
};
function isVercelOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}
function isCorsOrigin(origin) {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  if (isVercelOrigin(origin)) return true;
  if (config.nodeEnv === "production") return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

// ../api/src/middleware/error-handler.ts
import { ZodError } from "zod";

// ../api/src/errors/app-error.ts
var AppError = class extends Error {
  status;
  code;
  details;
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
};

// ../api/src/middleware/error-handler.ts
var errorHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Validation failed",
        details: error.flatten()
      }
    });
    return;
  }
  if (error instanceof AppError) {
    const body = {
      error: {
        code: error.code,
        message: error.message
      }
    };
    if (error.details !== void 0) {
      body.error.details = error.details;
    }
    res.status(error.status).json(body);
    return;
  }
  logger.error("unhandled error", {
    message: error instanceof Error ? error.message : "unknown error"
  });
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      ...config.nodeEnv === "development" && error instanceof Error ? { details: error.message } : {}
    }
  });
};

// ../api/src/middleware/not-found.ts
var notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `No route for ${req.method} ${req.path}`
    }
  });
};

// ../api/src/middleware/request-logger.ts
var requestLogger = (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started
    });
  });
  next();
};

// ../api/src/routes/index.ts
import { Router as Router6 } from "express";

// ../api/src/admin/routes.ts
import { Router } from "express";
import { z as z7 } from "zod";

// ../api/src/admin/catalog.ts
import { z as z2 } from "zod";

// ../api/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var adminClient = null;
function isSupabaseConfigured() {
  return config.supabaseUrl.length > 0 && config.supabaseServiceRoleKey.length > 0;
}
function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return adminClient;
}

// ../api/src/admin/catalog.ts
var idSchema = z2.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
var slugSchema = z2.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
var textSchema = z2.string().trim().min(1).max(200);
var optionalText = z2.string().trim().max(200);
var fieldTypeSchema = z2.enum(["text", "number", "boolean"]);
var fieldSectionSchema = z2.enum(["spec", "features", "info"]);
var localized = z2.object({
  he: textSchema,
  ar: textSchema
});
var storedImage = z2.string().max(2e6).default("");
var imageSchema = z2.object({
  id: idSchema,
  src: z2.string().trim().min(1).max(2e6)
});
var variantSchema = z2.object({
  id: idSchema,
  color: z2.string().trim().max(80),
  colorHex: z2.string().trim().max(20),
  stock: z2.number().int().min(0).max(1e6),
  active: z2.boolean(),
  images: z2.array(imageSchema).max(12)
});
var productSchema = z2.object({
  id: idSchema,
  name: localized,
  priceMinor: z2.number().int().min(0).max(1e8),
  brandId: idSchema,
  categoryId: idSchema,
  subcategoryId: z2.string().max(80),
  specs: z2.record(z2.string().max(8e3)).refine((value) => Object.keys(value).length <= 40),
  variants: z2.array(variantSchema).max(20)
});
var catalogSchema = z2.object({
  categories: z2.array(
    z2.object({
      id: idSchema,
      slug: slugSchema,
      name: localized,
      image: storedImage,
      subcategories: z2.array(z2.object({ id: idSchema, name: localized, image: storedImage })).max(40),
      fields: z2.array(
        z2.object({
          id: idSchema,
          label: localized,
          type: fieldTypeSchema,
          section: fieldSectionSchema.default("features")
        })
      ).max(40)
    })
  ).max(80),
  brands: z2.array(z2.object({ id: idSchema, slug: slugSchema, name: textSchema, image: storedImage })).max(80),
  products: z2.array(productSchema).max(200),
  coupons: z2.array(
    z2.object({
      id: idSchema,
      code: z2.string().trim().min(1).max(40),
      kind: z2.enum(["percent", "fixed"]),
      value: z2.number().int().positive().max(1e7),
      endsAt: z2.string().max(40)
    })
  ).max(100),
  settings: z2.object({
    phone: z2.string().trim().max(40),
    accent: z2.string().trim().min(1).max(40),
    zones: z2.array(
      z2.object({
        id: idSchema,
        nameHe: textSchema,
        nameAr: optionalText,
        priceMinor: z2.number().int().min(0).max(1e7),
        active: z2.boolean(),
        sortOrder: z2.number().int().min(0).max(1e4)
      })
    ).max(40)
  })
});
function db() {
  return getSupabaseAdmin();
}
function fail(error) {
  logger.error("database error", { code: error?.code, message: error?.message });
  if (error?.code === "23505") throw new AppError(409, "conflict", "Already exists");
  if (error?.code === "23503") throw new AppError(409, "in_use", "Still in use");
  throw new AppError(500, "database", "Database write failed");
}
function check(error) {
  if (error) fail(error);
}
function parseCatalog(input) {
  return catalogSchema.parse(input);
}
async function isCatalogEmpty() {
  const [brands, categories, products] = await Promise.all([
    db().from("brands").select("id", { count: "exact", head: true }),
    db().from("categories").select("id", { count: "exact", head: true }),
    db().from("products").select("id", { count: "exact", head: true })
  ]);
  check(brands.error);
  check(categories.error);
  check(products.error);
  return (brands.count ?? 0) === 0 && (categories.count ?? 0) === 0 && (products.count ?? 0) === 0;
}
async function readCatalog() {
  const client = db();
  const [categories, subcategories, fields, brands, products, specs, variants, images, coupons, settings, zones] = await Promise.all([
    client.from("categories").select("id, slug, name_he, name_ar, image_src, sort_order").order("sort_order"),
    client.from("subcategories").select("id, category_id, name_he, name_ar, image_src, sort_order").order("sort_order"),
    client.from("category_fields").select("id, category_id, label_he, label_ar, field_type, section, sort_order").order("sort_order"),
    client.from("brands").select("id, slug, name, image_src, sort_order").order("sort_order"),
    client.from("products").select("id, name_he, name_ar, price_minor, brand_id, category_id, subcategory_id, sort_order").order("sort_order"),
    client.from("product_specs").select("product_id, field_id, value"),
    client.from("product_variants").select("id, product_id, color, color_hex, stock, is_active, sort_order").order("sort_order"),
    client.from("variant_images").select("id, variant_id, src, sort_order").order("sort_order"),
    client.from("coupons").select("id, code, kind, value, ends_at, sort_order").order("sort_order"),
    client.from("store_settings").select("phone, accent").eq("id", true).maybeSingle(),
    client.from("shipping_zones").select("id, name, name_ar, price_minor, is_active, sort_order").order("sort_order")
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
      image: category.image_src ?? "",
      subcategories: (subsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        name: { he: item.name_he, ar: item.name_ar },
        image: item.image_src ?? ""
      })),
      fields: (fieldsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        label: { he: item.label_he, ar: item.label_ar },
        type: item.field_type,
        section: item.section === "spec" || item.section === "info" ? item.section : "features"
      }))
    })),
    brands: (brands.data ?? []).map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: brand.image_src ?? ""
    })),
    products: (products.data ?? []).map((product) => ({
      id: product.id,
      name: { he: product.name_he, ar: product.name_ar },
      priceMinor: product.price_minor,
      brandId: product.brand_id,
      categoryId: product.category_id,
      subcategoryId: product.subcategory_id ?? "",
      specs: Object.fromEntries((specsByProduct.get(product.id) ?? []).map((item) => [item.field_id, item.value])),
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        color: variant.color,
        colorHex: variant.color_hex,
        stock: variant.stock,
        active: variant.is_active,
        images: (imagesByVariant.get(variant.id) ?? []).map((image) => ({ id: image.id, src: image.src }))
      }))
    })),
    coupons: (coupons.data ?? []).map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.value,
      endsAt: coupon.ends_at
    })),
    settings: {
      phone: settings.data?.phone ?? "",
      accent: settings.data?.accent || "burgundy",
      zones: (zones.data ?? []).map((zone) => ({
        id: zone.id,
        nameHe: zone.name,
        nameAr: zone.name_ar ?? "",
        priceMinor: zone.price_minor,
        active: zone.is_active,
        sortOrder: zone.sort_order
      }))
    }
  };
}
function group(rows, key) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}
async function importCatalog(input) {
  if (!await isCatalogEmpty()) return readCatalog();
  const client = db();
  if (input.brands.length > 0) {
    const { error } = await client.from("brands").insert(
      input.brands.map((brand, index) => ({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        image_src: brand.image,
        sort_order: index
      }))
    );
    check(error);
  }
  if (input.categories.length > 0) {
    const { error } = await client.from("categories").insert(
      input.categories.map((category, index) => ({
        id: category.id,
        slug: category.slug,
        name_he: category.name.he,
        name_ar: category.name.ar,
        image_src: category.image,
        sort_order: index
      }))
    );
    check(error);
  }
  const subcategories = input.categories.flatMap(
    (category) => category.subcategories.map((item, index) => ({
      id: item.id,
      category_id: category.id,
      name_he: item.name.he,
      name_ar: item.name.ar,
      image_src: item.image,
      sort_order: index
    }))
  );
  if (subcategories.length > 0) check((await client.from("subcategories").insert(subcategories)).error);
  const fields = input.categories.flatMap(
    (category) => category.fields.map((item, index) => ({
      id: item.id,
      category_id: category.id,
      label_he: item.label.he,
      label_ar: item.label.ar,
      field_type: item.type,
      section: item.section,
      sort_order: index
    }))
  );
  if (fields.length > 0) check((await client.from("category_fields").insert(fields)).error);
  if (input.products.length > 0) {
    check(
      (await client.from("products").insert(
        input.products.map((product, index) => ({
          id: product.id,
          name_he: product.name.he,
          name_ar: product.name.ar,
          price_minor: product.priceMinor,
          brand_id: product.brandId,
          category_id: product.categoryId,
          subcategory_id: product.subcategoryId || null,
          sort_order: index
        }))
      )).error
    );
  }
  const variants = input.products.flatMap(
    (product) => product.variants.map((variant, index) => ({
      id: variant.id,
      product_id: product.id,
      color: variant.color,
      color_hex: variant.colorHex || "#172033",
      stock: variant.stock,
      is_active: variant.active,
      sort_order: index
    }))
  );
  if (variants.length > 0) check((await client.from("product_variants").insert(variants)).error);
  const images = input.products.flatMap(
    (product) => product.variants.flatMap(
      (variant) => variant.images.map((image, index) => ({
        id: image.id,
        variant_id: variant.id,
        src: image.src,
        sort_order: index
      }))
    )
  );
  if (images.length > 0) check((await client.from("variant_images").insert(images)).error);
  const specs = input.products.flatMap(
    (product) => Object.entries(product.specs).filter(([, value]) => value.trim()).map(([fieldId, value]) => ({ product_id: product.id, field_id: fieldId, value }))
  );
  if (specs.length > 0) check((await client.from("product_specs").insert(specs)).error);
  if (input.coupons.length > 0) {
    check(
      (await client.from("coupons").insert(
        input.coupons.map((coupon, index) => ({
          id: coupon.id,
          code: coupon.code,
          kind: coupon.kind,
          value: coupon.value,
          ends_at: coupon.endsAt,
          sort_order: index
        }))
      )).error
    );
  }
  await writeSettings(input.settings);
  return readCatalog();
}
async function nextSort(table) {
  const { data, error } = await db().from(table).select("sort_order").order("sort_order", { ascending: true }).limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? 0) - 1;
}
async function nextChildSort(table, categoryId) {
  const { data, error } = await db().from(table).select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? -1) + 1;
}
var categoryInput = z2.object({
  id: idSchema,
  slug: slugSchema,
  nameHe: textSchema,
  nameAr: optionalText,
  image: storedImage
});
async function createCategory(input) {
  const nameAr = input.nameAr || input.nameHe;
  const { error } = await db().from("categories").insert({
    id: input.id,
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: nameAr,
    image_src: input.image,
    sort_order: await nextSort("categories")
  });
  check(error);
}
async function updateCategory(id, input) {
  const { error } = await db().from("categories").update({
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image
  }).eq("id", id);
  check(error);
}
async function deleteCategory(id) {
  const used = await db().from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  check(used.error);
  if ((used.count ?? 0) > 0) throw new AppError(409, "in_use", "Category still has products");
  const { error } = await db().from("categories").delete().eq("id", id);
  check(error);
}
var namedInput = z2.object({
  id: idSchema,
  nameHe: textSchema,
  nameAr: optionalText
});
var subcategoryInput = namedInput.extend({
  image: storedImage
});
async function createSubcategory(categoryId, input) {
  const { error } = await db().from("subcategories").insert({
    id: input.id,
    category_id: categoryId,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image,
    sort_order: await nextChildSort("subcategories", categoryId)
  });
  check(error);
}
async function updateSubcategory(id, input) {
  const { error } = await db().from("subcategories").update({
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image
  }).eq("id", id);
  check(error);
}
async function deleteSubcategory(id) {
  const { error } = await db().from("subcategories").delete().eq("id", id);
  check(error);
}
var fieldInput = namedInput.extend({
  type: fieldTypeSchema,
  section: fieldSectionSchema.default("features")
});
async function createField(categoryId, input) {
  const { error } = await db().from("category_fields").insert({
    id: input.id,
    category_id: categoryId,
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section,
    sort_order: await nextChildSort("category_fields", categoryId)
  });
  check(error);
}
async function updateField(id, input) {
  const { error } = await db().from("category_fields").update({
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section
  }).eq("id", id);
  check(error);
}
async function deleteField(id) {
  const { error } = await db().from("category_fields").delete().eq("id", id);
  check(error);
}
var brandInput = z2.object({
  id: idSchema,
  name: textSchema,
  slug: slugSchema,
  image: storedImage
});
async function createBrand(input) {
  const { error } = await db().from("brands").insert({
    id: input.id,
    name: input.name,
    slug: input.slug,
    image_src: input.image,
    sort_order: await nextSort("brands")
  });
  check(error);
}
async function updateBrand(id, input) {
  const { error } = await db().from("brands").update({ name: input.name, slug: input.slug, image_src: input.image }).eq("id", id);
  check(error);
}
async function deleteBrand(id) {
  const used = await db().from("products").select("id", { count: "exact", head: true }).eq("brand_id", id);
  check(used.error);
  if ((used.count ?? 0) > 0) throw new AppError(409, "in_use", "Brand still has products");
  const { error } = await db().from("brands").delete().eq("id", id);
  check(error);
}
async function saveProduct(input) {
  const client = db();
  const existing = await client.from("products").select("sort_order").eq("id", input.id).maybeSingle();
  check(existing.error);
  const row = {
    id: input.id,
    name_he: input.name.he,
    name_ar: input.name.ar,
    price_minor: input.priceMinor,
    brand_id: input.brandId,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId || null,
    sort_order: existing.data?.sort_order ?? await nextSort("products")
  };
  check((await client.from("products").upsert(row)).error);
  check((await client.from("product_specs").delete().eq("product_id", input.id)).error);
  check((await client.from("product_variants").delete().eq("product_id", input.id)).error);
  if (input.variants.length > 0) {
    check(
      (await client.from("product_variants").insert(
        input.variants.map((variant, index) => ({
          id: variant.id,
          product_id: input.id,
          color: variant.color,
          color_hex: variant.colorHex || "#172033",
          stock: variant.stock,
          is_active: variant.active,
          sort_order: index
        }))
      )).error
    );
  }
  const images = input.variants.flatMap(
    (variant) => variant.images.map((image, index) => ({
      id: image.id,
      variant_id: variant.id,
      src: image.src,
      sort_order: index
    }))
  );
  if (images.length > 0) check((await client.from("variant_images").insert(images)).error);
  const specs = Object.entries(input.specs).filter(([, value]) => value.trim()).map(([fieldId, value]) => ({ product_id: input.id, field_id: fieldId, value }));
  if (specs.length > 0) check((await client.from("product_specs").insert(specs)).error);
}
async function deleteProduct(id) {
  const { error } = await db().from("products").delete().eq("id", id);
  check(error);
}
var couponInput = z2.object({
  id: idSchema,
  code: z2.string().trim().min(1).max(40),
  kind: z2.enum(["percent", "fixed"]),
  value: z2.number().int().positive().max(1e7),
  endsAt: z2.string().max(40)
});
async function saveCoupon(input) {
  const existing = await db().from("coupons").select("sort_order").eq("id", input.id).maybeSingle();
  check(existing.error);
  const { error } = await db().from("coupons").upsert({
    id: input.id,
    code: input.code.toUpperCase(),
    kind: input.kind,
    value: input.value,
    ends_at: input.endsAt,
    sort_order: existing.data?.sort_order ?? await nextSort("coupons")
  });
  check(error);
}
async function deleteCoupon(id) {
  const { error } = await db().from("coupons").delete().eq("id", id);
  check(error);
}
var settingsInput = z2.object({
  phone: z2.string().trim().max(40),
  accent: z2.string().trim().min(1).max(40),
  zones: catalogSchema.shape.settings.shape.zones
});
async function writeSettings(input) {
  const client = db();
  check(
    (await client.from("store_settings").upsert({
      id: true,
      phone: input.phone,
      accent: input.accent
    })).error
  );
  if (input.zones.length === 0) {
    check((await client.from("shipping_zones").delete().neq("id", "")).error);
    return;
  }
  check(
    (await client.from("shipping_zones").upsert(
      input.zones.map((zone) => ({
        id: zone.id,
        name: zone.nameHe,
        name_ar: zone.nameAr,
        price_minor: zone.priceMinor,
        is_active: zone.active,
        sort_order: zone.sortOrder
      }))
    )).error
  );
  check(
    (await client.from("shipping_zones").delete().not("id", "in", `(${input.zones.map((zone) => `"${zone.id}"`).join(",")})`)).error
  );
}

// ../api/src/orders/orders.ts
import { z as z3 } from "zod";
var lineSchema = z3.object({
  productId: z3.string().trim().min(1).max(80),
  quantity: z3.number().int().min(1).max(10)
});
var quoteSchema = z3.object({
  lines: z3.array(lineSchema).min(1).max(30),
  couponCode: z3.string().trim().max(40).default("")
});
var placeSchema = quoteSchema.extend({
  note: z3.string().trim().max(500).default(""),
  customer: z3.object({
    name: z3.string().trim().min(2).max(80),
    email: z3.string().trim().email().max(160),
    phone: z3.string().trim().min(8).max(30)
  }),
  locale: z3.enum(["he", "ar"]).default("he"),
  delivery: z3.object({
    method: z3.enum(["pickup", "home"]),
    zoneId: z3.string().trim().max(80).default(""),
    city: z3.string().trim().max(80).default(""),
    street: z3.string().trim().max(120).default(""),
    house: z3.string().trim().max(20).default(""),
    apartment: z3.string().trim().max(20).default("")
  })
});
function db2() {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  return getSupabaseAdmin();
}
async function optionalUser(req) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data } = await db2().auth.getUser(token);
  return data.user ?? null;
}
async function pricedLines(lines) {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const products = await db2().from("products").select("id, name_he, name_ar, price_minor").in("id", ids);
  if (products.error) throw new AppError(500, "database", "Database write failed");
  const variants = await db2().from("product_variants").select("id, product_id, stock, is_active, sort_order").in("product_id", ids).order("sort_order");
  if (variants.error) throw new AppError(500, "database", "Database write failed");
  const variantIds = (variants.data ?? []).map((variant) => variant.id);
  const images = variantIds.length === 0 ? { data: [], error: null } : await db2().from("variant_images").select("variant_id, src, sort_order").in("variant_id", variantIds).order("sort_order");
  if (images.error) throw new AppError(500, "database", "Database write failed");
  return lines.map((line) => {
    const product = (products.data ?? []).find((item) => item.id === line.productId);
    if (!product) throw new AppError(400, "missing_product", "A cart product is no longer available");
    const choices = (variants.data ?? []).filter((variant2) => variant2.product_id === product.id && variant2.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const variant = choices.find((item) => item.stock >= line.quantity) ?? choices[0];
    if (!variant || variant.stock < line.quantity) {
      throw new AppError(409, "stock", "Not enough stock");
    }
    const image = (images.data ?? []).find((item) => item.variant_id === variant.id)?.src ?? "";
    return {
      productId: product.id,
      variantId: variant.id,
      name: { he: product.name_he, ar: product.name_ar },
      image,
      unitPriceMinor: product.price_minor,
      quantity: line.quantity,
      lineTotalMinor: product.price_minor * line.quantity,
      stock: variant.stock
    };
  });
}
async function discountFor(subtotalMinor, couponCode) {
  const code = couponCode.trim().toUpperCase();
  if (!code) return { code: "", discountMinor: 0 };
  const coupon = await db2().from("coupons").select("code, kind, value, ends_at").eq("code", code).maybeSingle();
  if (coupon.error) throw new AppError(500, "database", "Database write failed");
  if (!coupon.data) throw new AppError(400, "coupon", "Coupon was not found");
  if (coupon.data.ends_at && coupon.data.ends_at < (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
    throw new AppError(400, "coupon", "Coupon was not found");
  }
  const discountMinor = coupon.data.kind === "percent" ? Math.min(subtotalMinor, Math.round(subtotalMinor * coupon.data.value / 100)) : Math.min(subtotalMinor, coupon.data.value);
  return { code: coupon.data.code, discountMinor };
}
async function quoteOrder(input) {
  const lines = await pricedLines(input.lines);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const coupon = await discountFor(subtotalMinor, input.couponCode);
  return {
    subtotalMinor,
    discountMinor: coupon.discountMinor,
    totalMinor: subtotalMinor - coupon.discountMinor,
    couponCode: coupon.code
  };
}
function mapOrder(row, items) {
  return {
    id: String(row.id),
    number: String(row.number),
    placedAt: String(row.placed_at),
    status: row.status,
    subtotalMinor: Number(row.subtotal_minor),
    discountMinor: Number(row.discount_minor),
    totalMinor: Number(row.total_minor),
    couponCode: String(row.coupon_code ?? ""),
    note: String(row.note ?? ""),
    deliveryMethod: row.delivery_method === "home" ? "home" : "pickup",
    deliveryMinor: Number(row.delivery_minor ?? 0),
    shippingZone: String(row.shipping_zone ?? ""),
    shippingAddress: String(row.shipping_address ?? ""),
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    items
  };
}
async function itemsFor(orderIds) {
  const grouped = /* @__PURE__ */ new Map();
  if (orderIds.length === 0) return grouped;
  const result = await db2().from("order_items").select("id, order_id, product_name_he, product_name_ar, image_src, unit_price_minor, quantity, line_total_minor").in("order_id", orderIds);
  if (result.error) throw new AppError(500, "database", "Database write failed");
  for (const item of result.data ?? []) {
    const list = grouped.get(item.order_id) ?? [];
    list.push({
      id: item.id,
      name: { he: item.product_name_he, ar: item.product_name_ar },
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
      image: item.image_src
    });
    grouped.set(item.order_id, list);
  }
  return grouped;
}
async function decrementStock(lines) {
  const applied = [];
  for (const line of lines) {
    const next = line.stock - line.quantity;
    const result = await db2().from("product_variants").update({ stock: next }).eq("id", line.variantId).eq("stock", line.stock).select("id");
    if (result.error || !result.data?.length) {
      await restoreStock(applied);
      throw new AppError(409, "stock", "Not enough stock");
    }
    applied.push(line);
  }
}
async function restoreStock(lines) {
  for (const line of lines) {
    await db2().from("product_variants").update({ stock: line.stock }).eq("id", line.variantId).eq("stock", line.stock - line.quantity);
  }
}
async function listShippingZones() {
  const result = await db2().from("shipping_zones").select("id, name, name_ar, price_minor, is_active, sort_order").eq("is_active", true).order("sort_order");
  if (result.error) throw new AppError(500, "database", "Database write failed");
  return (result.data ?? []).map((zone) => ({
    id: zone.id,
    nameHe: zone.name,
    nameAr: zone.name_ar || zone.name,
    priceMinor: zone.price_minor
  }));
}
async function deliveryFor(input, locale) {
  if (input.method === "pickup") {
    return { method: "pickup", minor: 0, zoneName: "", address: "" };
  }
  if (!input.city || !input.street || !input.house) {
    throw new AppError(400, "address", "Address is required");
  }
  const zones = await listShippingZones();
  const zone = zones.find((item) => item.id === input.zoneId);
  if (!zone) throw new AppError(400, "zone", "Choose a shipping area");
  const zoneName = locale === "ar" ? zone.nameAr : zone.nameHe;
  const address = [input.street, input.house, input.apartment, input.city, zoneName].filter(Boolean).join(", ");
  return { method: "home", minor: zone.priceMinor, zoneName, address };
}
async function placeOrder(input, customerId) {
  const lines = await pricedLines(input.lines);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const coupon = await discountFor(subtotalMinor, input.couponCode);
  const delivery = await deliveryFor(input.delivery, input.locale);
  const totalMinor = subtotalMinor - coupon.discountMinor + delivery.minor;
  await decrementStock(lines);
  const id = `ord-${crypto.randomUUID()}`;
  const number = String(1e7 + Math.floor(Math.random() * 9e7));
  const inserted = await db2().from("orders").insert({
    id,
    number,
    customer_id: customerId,
    customer_email: input.customer.email.toLowerCase(),
    customer_name: input.customer.name,
    customer_phone: input.customer.phone,
    status: "placed",
    subtotal_minor: subtotalMinor,
    discount_minor: coupon.discountMinor,
    total_minor: totalMinor,
    coupon_code: coupon.code,
    note: input.note,
    locale: input.locale,
    delivery_method: delivery.method,
    delivery_minor: delivery.minor,
    shipping_zone: delivery.zoneName,
    shipping_address: delivery.address
  }).select("*").single();
  if (inserted.error || !inserted.data) {
    await restoreStock(lines);
    throw new AppError(500, "database", "Database write failed");
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
    line_total_minor: line.lineTotalMinor
  }));
  const items = await db2().from("order_items").insert(itemRows);
  if (items.error) {
    await db2().from("orders").delete().eq("id", id);
    await restoreStock(lines);
    throw new AppError(500, "database", "Database write failed");
  }
  return mapOrder(inserted.data, itemRows.map((item) => ({
    id: item.id,
    name: { he: item.product_name_he, ar: item.product_name_ar },
    quantity: item.quantity,
    unitPriceMinor: item.unit_price_minor,
    lineTotalMinor: item.line_total_minor,
    image: item.image_src
  })));
}
async function listOrdersForUser(userId, email) {
  const byId = await db2().from("orders").select("*").eq("customer_id", userId).order("placed_at", { ascending: false });
  if (byId.error) throw new AppError(500, "database", "Database write failed");
  const byEmail = email ? await db2().from("orders").select("*").ilike("customer_email", email).order("placed_at", { ascending: false }) : { data: [], error: null };
  if (byEmail.error) throw new AppError(500, "database", "Database write failed");
  const rows = [...byId.data ?? [], ...byEmail.data ?? []];
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  const items = await itemsFor(unique.map((row) => row.id));
  return unique.map((row) => mapOrder(row, items.get(row.id) ?? []));
}
async function orderForUser(id, userId, email) {
  const orders = await listOrdersForUser(userId, email);
  const order = orders.find((item) => item.id === id);
  if (!order) throw new AppError(404, "not_found", "Order was not found");
  return order;
}
var orderStatusSchema = z3.enum(["placed", "processing", "ready", "shipping", "completed", "cancelled"]);
async function updateOrderStatus(id, status) {
  const current = await db2().from("orders").select("id, delivery_method").eq("id", id).maybeSingle();
  if (current.error) throw new AppError(500, "database", "Database write failed");
  if (!current.data) throw new AppError(404, "not_found", "Order was not found");
  const home = current.data.delivery_method === "home";
  if (status === "ready" && home) throw new AppError(400, "status", "Ready is only for store pickup");
  if (status === "shipping" && !home) throw new AppError(400, "status", "Shipping is only for home delivery");
  const result = await db2().from("orders").update({ status }).eq("id", id).select("id").maybeSingle();
  if (result.error) throw new AppError(500, "database", "Database write failed");
  if (!result.data) throw new AppError(404, "not_found", "Order was not found");
}
async function countRegisteredCustomers() {
  let page = 1;
  let total = 0;
  for (; ; ) {
    const result = await db2().auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new AppError(500, "database", "Database write failed");
    const batch = result.data.users.length;
    total += batch;
    if (batch < 200 || page >= 20) break;
    page += 1;
  }
  return total;
}
async function listAllOrders() {
  const result = await db2().from("orders").select("*").order("placed_at", { ascending: false });
  if (result.error) throw new AppError(500, "database", "Database write failed");
  const rows = result.data ?? [];
  const items = await itemsFor(rows.map((row) => row.id));
  return rows.map((row) => mapOrder(row, items.get(row.id) ?? []));
}

// ../api/src/packages/packages.ts
import { z as z4 } from "zod";
var textSchema2 = z4.string().trim().min(1).max(200);
var optionalText2 = z4.string().trim().max(200);
var packageInput = z4.object({
  id: idSchema,
  nameHe: textSchema2,
  nameAr: optionalText2,
  priceMinor: z4.number().int().min(0).max(1e7),
  active: z4.boolean(),
  productIds: z4.array(idSchema).min(2).max(30)
});
function db3() {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  return getSupabaseAdmin();
}
function fail2(error) {
  if (!error) return;
  throw new AppError(500, "database", "Database write failed");
}
async function itemsByPackage(ids) {
  const grouped = /* @__PURE__ */ new Map();
  if (ids.length === 0) return grouped;
  const result = await db3().from("package_items").select("package_id, product_id").in("package_id", ids);
  fail2(result.error);
  for (const row of result.data ?? []) {
    const list = grouped.get(row.package_id) ?? [];
    list.push(row.product_id);
    grouped.set(row.package_id, list);
  }
  return grouped;
}
function mapPackage(row, productIds) {
  return {
    id: row.id,
    nameHe: row.name_he,
    nameAr: row.name_ar || row.name_he,
    priceMinor: row.price_minor,
    active: row.is_active,
    productIds
  };
}
async function listPackages(activeOnly) {
  let query = db3().from("packages").select("id, name_he, name_ar, price_minor, is_active, sort_order").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);
  const result = await query;
  fail2(result.error);
  const rows = result.data ?? [];
  const items = await itemsByPackage(rows.map((row) => row.id));
  return rows.map((row) => mapPackage(row, items.get(row.id) ?? []));
}
async function savePackage(input) {
  const productIds = [...new Set(input.productIds)];
  if (productIds.length < 2) throw new AppError(400, "products", "Choose at least two products");
  const products = await db3().from("products").select("id").in("id", productIds);
  fail2(products.error);
  if ((products.data ?? []).length !== productIds.length) {
    throw new AppError(400, "products", "A selected product is no longer available");
  }
  const existing = await db3().from("packages").select("sort_order").eq("id", input.id).maybeSingle();
  fail2(existing.error);
  const sortOrder = existing.data?.sort_order ?? await nextSort2();
  const saved = await db3().from("packages").upsert({
    id: input.id,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    price_minor: input.priceMinor,
    is_active: input.active,
    sort_order: sortOrder
  });
  fail2(saved.error);
  const cleared = await db3().from("package_items").delete().eq("package_id", input.id);
  fail2(cleared.error);
  const inserted = await db3().from("package_items").insert(
    productIds.map((productId) => ({
      id: `pi-${crypto.randomUUID()}`,
      package_id: input.id,
      product_id: productId
    }))
  );
  fail2(inserted.error);
}
async function deletePackage(id) {
  const result = await db3().from("packages").delete().eq("id", id);
  fail2(result.error);
}
async function nextSort2() {
  const result = await db3().from("packages").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  fail2(result.error);
  return (result.data?.[0]?.sort_order ?? 0) + 1;
}

// ../../packages/shared/src/money.ts
var ILS = "ILS";
var formatters = {
  he: new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: ILS,
    maximumFractionDigits: 0,
    numberingSystem: "latn"
  }),
  ar: new Intl.NumberFormat("ar-IL", {
    style: "currency",
    currency: ILS,
    maximumFractionDigits: 0,
    numberingSystem: "latn"
  })
};

// ../../packages/shared/src/schemas/health.ts
import { z as z5 } from "zod";
var healthResponseSchema = z5.object({
  status: z5.literal("ok"),
  service: z5.literal("anan-api"),
  version: z5.string().min(1),
  timestamp: z5.string().datetime(),
  supabase: z5.enum(["configured", "not_configured"])
});

// ../../packages/shared/src/admin.ts
var adminEmails = ["salonanan24@gmail.com"];
function isAdminEmail(email) {
  const folded = email?.trim().toLowerCase() ?? "";
  return adminEmails.some((item) => item === folded);
}

// ../../packages/shared/src/schemas/coupon.ts
import { z as z6 } from "zod";
var couponCodeSchema = z6.object({
  code: z6.string().trim().min(4).max(20).regex(/^[A-Za-z0-9-]+$/)
});

// ../api/src/admin/require-admin.ts
async function requireAdmin(req, _res, next) {
  if (!isSupabaseConfigured()) {
    throw new AppError(503, "not_configured", "Database is not configured");
  }
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AppError(401, "unauthorized", "Sign in required");
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !isAdminEmail(data.user?.email)) {
    throw new AppError(403, "forbidden", "Admin only");
  }
  next();
}

// ../api/src/admin/wrap.ts
function wrap(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// ../api/src/admin/routes.ts
var adminRouter = Router();
adminRouter.use(wrap(requireAdmin));
adminRouter.get(
  "/orders",
  wrap(async (_req, res) => {
    res.json({ orders: await listAllOrders() });
  })
);
adminRouter.patch(
  "/orders/:id",
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const status = z7.enum(["placed", "processing", "ready", "shipping", "completed", "cancelled"]).parse(req.body?.status);
    await updateOrderStatus(id, status);
    res.json({ ok: true });
  })
);
adminRouter.get(
  "/customers/count",
  wrap(async (_req, res) => {
    res.json({ count: await countRegisteredCustomers() });
  })
);
adminRouter.get(
  "/catalog",
  wrap(async (_req, res) => {
    const empty = await isCatalogEmpty();
    const catalog = empty ? {
      categories: [],
      brands: [],
      products: [],
      coupons: [],
      settings: (await readCatalog()).settings
    } : await readCatalog();
    res.json({ empty, catalog });
  })
);
adminRouter.post(
  "/catalog/import",
  wrap(async (req, res) => {
    const catalog = await importCatalog(parseCatalog(req.body));
    res.json({ catalog });
  })
);
adminRouter.post(
  "/categories",
  wrap(async (req, res) => {
    await createCategory(categoryInput.parse(req.body));
    res.status(201).json({ ok: true });
  })
);
adminRouter.patch(
  "/categories/:id",
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = categoryInput.omit({ id: true }).parse(req.body);
    await updateCategory(id, input);
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/categories/:id",
  wrap(async (req, res) => {
    await deleteCategory(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.post(
  "/categories/:id/subcategories",
  wrap(async (req, res) => {
    await createSubcategory(idSchema.parse(req.params.id), subcategoryInput.parse(req.body));
    res.status(201).json({ ok: true });
  })
);
adminRouter.patch(
  "/subcategories/:id",
  wrap(async (req, res) => {
    await updateSubcategory(idSchema.parse(req.params.id), subcategoryInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/subcategories/:id",
  wrap(async (req, res) => {
    await deleteSubcategory(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.post(
  "/categories/:id/fields",
  wrap(async (req, res) => {
    await createField(idSchema.parse(req.params.id), fieldInput.parse(req.body));
    res.status(201).json({ ok: true });
  })
);
adminRouter.patch(
  "/fields/:id",
  wrap(async (req, res) => {
    await updateField(idSchema.parse(req.params.id), fieldInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/fields/:id",
  wrap(async (req, res) => {
    await deleteField(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.post(
  "/brands",
  wrap(async (req, res) => {
    await createBrand(brandInput.parse(req.body));
    res.status(201).json({ ok: true });
  })
);
adminRouter.patch(
  "/brands/:id",
  wrap(async (req, res) => {
    await updateBrand(idSchema.parse(req.params.id), brandInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/brands/:id",
  wrap(async (req, res) => {
    await deleteBrand(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.put(
  "/products/:id",
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const product = productSchema.parse({ ...req.body, id });
    await saveProduct(product);
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/products/:id",
  wrap(async (req, res) => {
    await deleteProduct(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.put(
  "/coupons/:id",
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await saveCoupon(couponInput.parse({ ...req.body, id }));
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/coupons/:id",
  wrap(async (req, res) => {
    await deleteCoupon(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.get(
  "/packages",
  wrap(async (_req, res) => {
    res.json({ packages: await listPackages(false) });
  })
);
adminRouter.put(
  "/packages/:id",
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await savePackage(packageInput.parse({ ...req.body, id }));
    res.json({ ok: true });
  })
);
adminRouter.delete(
  "/packages/:id",
  wrap(async (req, res) => {
    await deletePackage(idSchema.parse(req.params.id));
    res.json({ ok: true });
  })
);
adminRouter.put(
  "/settings",
  wrap(async (req, res) => {
    await writeSettings(settingsInput.parse(req.body));
    res.json({ ok: true });
  })
);

// ../api/src/routes/catalog.ts
import { Router as Router2 } from "express";

// ../api/src/catalog/storefront.ts
var refrigeratorTypes = /* @__PURE__ */ new Set(["single-door", "bottom-freezer"]);
var freezerPositions = /* @__PURE__ */ new Set(["bottom"]);
var loadTypes = /* @__PURE__ */ new Set(["front"]);
function specValue(specs, key) {
  for (const [field, value] of Object.entries(specs)) {
    if (field !== key && !field.endsWith(`-${key}`)) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return void 0;
}
function numberSpec(specs, key) {
  const raw = specValue(specs, key);
  if (!raw) return void 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : void 0;
}
function attributesFrom(specs) {
  const attributes = {};
  const refrigeratorType = specValue(specs, "refrigeratorType");
  if (refrigeratorType && refrigeratorTypes.has(refrigeratorType)) attributes.refrigeratorType = refrigeratorType;
  const freezerPosition = specValue(specs, "freezerPosition");
  if (freezerPosition && freezerPositions.has(freezerPosition)) attributes.freezerPosition = freezerPosition;
  const doors = numberSpec(specs, "doors");
  if (doors !== void 0) attributes.doors = doors;
  const screenInches = numberSpec(specs, "screenInches");
  if (screenInches !== void 0) attributes.screenInches = screenInches;
  const resolution = specValue(specs, "resolution");
  if (resolution?.toLowerCase() === "4k") attributes.resolution = "4k";
  const smartTv = specValue(specs, "smartTv");
  if (smartTv === "yes" || smartTv === "true") attributes.smartTv = true;
  if (smartTv === "no" || smartTv === "false") attributes.smartTv = false;
  const capacityKg = numberSpec(specs, "capacityKg");
  if (capacityKg !== void 0) attributes.capacityKg = capacityKg;
  const loadType = specValue(specs, "loadType");
  if (loadType && loadTypes.has(loadType)) attributes.loadType = loadType;
  const spinRpm = numberSpec(specs, "spinRpm");
  if (spinRpm !== void 0) attributes.spinRpm = spinRpm;
  return attributes;
}
function highlightFrom(specs, subcategory) {
  if (subcategory) return subcategory;
  const line = Object.values(specs).map((value) => value.trim()).filter((value) => value && value !== "yes" && value !== "no" && value.length <= 80 && /[^\u0000-\u007F]/.test(value)).slice(0, 3).join(" \xB7 ");
  return { he: line, ar: line };
}
function imagesFrom(product) {
  const active = product.variants.filter((variant) => variant.active);
  const source = active.some((variant) => variant.images.length > 0) ? active : product.variants;
  const images = source.flatMap((variant) => variant.images);
  if (images.length === 0) {
    return [
      {
        src: "/catalog/fallback.webp",
        alt: product.name,
        sort: 0,
        kind: "placeholder"
      }
    ];
  }
  return images.map((image, index) => ({
    src: image.src,
    alt: product.name,
    sort: index,
    kind: image.src.startsWith("/catalog/vis-") ? "placeholder" : "photo"
  }));
}
function detailsFrom(product, category) {
  const details = {
    spec: [],
    features: [],
    info: []
  };
  for (const field of category.fields) {
    const value = product.specs[field.id]?.trim() ?? "";
    if (!value) continue;
    const section = field.section === "spec" || field.section === "info" ? field.section : "features";
    details[section].push({ label: field.label, value });
  }
  return details;
}
function productSlug(id) {
  return id.startsWith("p-") ? id.slice(2) : id.toLowerCase();
}
function toStorefront(catalog) {
  const categories = new Map(catalog.categories.map((category) => [category.id, category]));
  return {
    isDevelopmentFixture: false,
    categories: catalog.categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: { he: "", ar: "" },
      image: category.image,
      subcategories: category.subcategories.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image
      }))
    })),
    brands: catalog.brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: brand.image,
      developmentFixture: false
    })),
    products: catalog.products.flatMap((product) => {
      const category = categories.get(product.categoryId);
      if (!category) return [];
      const subcategory = category.subcategories.find((item) => item.id === product.subcategoryId);
      return [
        {
          id: product.id,
          slug: productSlug(product.id),
          categorySlug: category.slug,
          brandId: product.brandId,
          subcategoryId: product.subcategoryId,
          name: product.name,
          highlight: highlightFrom(product.specs, subcategory?.name),
          price: { amountMinor: product.priceMinor, currency: "ILS" },
          compareAtPrice: null,
          badges: [],
          developmentFixture: false,
          images: imagesFrom(product),
          attributes: attributesFrom(product.specs),
          details: detailsFrom(product, category)
        }
      ];
    })
  };
}

// ../api/src/routes/catalog.ts
var catalogRouter = Router2();
catalogRouter.get(
  "/",
  wrap(async (_req, res) => {
    res.json(toStorefront(await readCatalog()));
  })
);

// ../api/src/routes/health.ts
import { Router as Router3 } from "express";

// ../api/src/validation/parse.ts
function parseWithSchema(schema, data, source) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, "validation_error", `Invalid ${source}`, result.error.flatten());
  }
  return result.data;
}

// ../api/src/routes/health.ts
var healthRouter = Router3();
healthRouter.get("/health", (_req, res) => {
  const body = parseWithSchema(
    healthResponseSchema,
    {
      status: "ok",
      service: "anan-api",
      version: "0.1.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      supabase: isSupabaseConfigured() ? "configured" : "not_configured"
    },
    "health response"
  );
  res.json(body);
});

// ../api/src/routes/orders.ts
import { Router as Router4 } from "express";
var ordersRouter = Router4();
ordersRouter.post(
  "/quote",
  wrap(async (req, res) => {
    res.json(await quoteOrder(quoteSchema.parse(req.body)));
  })
);
ordersRouter.post(
  "/",
  wrap(async (req, res) => {
    const input = placeSchema.parse(req.body);
    const user = await optionalUser(req);
    const order = await placeOrder(input, user?.id ?? null);
    res.status(201).json({ order });
  })
);
ordersRouter.get(
  "/shipping-zones",
  wrap(async (_req, res) => {
    res.json({ zones: await listShippingZones() });
  })
);
ordersRouter.get(
  "/",
  wrap(async (req, res) => {
    const user = await optionalUser(req);
    if (!user) throw new AppError(401, "unauthorized", "Sign in required");
    res.json({ orders: await listOrdersForUser(user.id, user.email ?? "") });
  })
);
ordersRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const user = await optionalUser(req);
    if (!user) throw new AppError(401, "unauthorized", "Sign in required");
    res.json({ order: await orderForUser(String(req.params.id), user.id, user.email ?? "") });
  })
);

// ../api/src/routes/packages.ts
import { Router as Router5 } from "express";
var packagesRouter = Router5();
packagesRouter.get(
  "/",
  wrap(async (_req, res) => {
    const packages = await listPackages(true);
    res.json({
      packages: packages.map((item) => ({
        id: item.id,
        name: { he: item.nameHe, ar: item.nameAr },
        priceMinor: item.priceMinor,
        productIds: item.productIds
      }))
    });
  })
);

// ../api/src/routes/index.ts
var apiRouter = Router6();
apiRouter.use(healthRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/packages", packagesRouter);
apiRouter.use("/admin", adminRouter);

// ../api/src/app.ts
function createApp() {
  const app2 = express();
  app2.disable("x-powered-by");
  app2.use(requestLogger);
  app2.use(express.json({ limit: "8mb" }));
  app2.use(
    cors({
      origin(origin, callback) {
        callback(null, isCorsOrigin(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    })
  );
  app2.use("/api", apiRouter);
  app2.use(notFoundHandler);
  app2.use(errorHandler);
  return app2;
}

// scripts/api-entry.ts
var app = createApp();
function handler(req, res) {
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    const queryIndex = url.indexOf("?");
    const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? "" : url.slice(queryIndex);
    const suffix = path.startsWith("/") ? path : `/${path}`;
    req.url = `/api${suffix === "/" ? "" : suffix}${query}`;
  }
  app(req, res);
}
export {
  handler as default
};
