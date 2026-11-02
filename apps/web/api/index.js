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
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM: z.string().default("onboarding@resend.dev")
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
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM
});
var config = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0),
  supabaseUrl: readUrl(parsed.SUPABASE_URL),
  supabaseAnonKey: parsed.SUPABASE_ANON_KEY.trim(),
  supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY.trim(),
  openaiApiKey: parsed.OPENAI_API_KEY.trim(),
  openaiModel: parsed.OPENAI_MODEL.trim() || "gpt-4o-mini",
  openaiBaseUrl: httpBase(parsed.OPENAI_BASE_URL),
  resendApiKey: parsed.RESEND_API_KEY.trim(),
  resendFrom: parsed.RESEND_FROM.trim() || "onboarding@resend.dev"
};
function httpBase(value) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "https://api.openai.com/v1";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "https://api.openai.com/v1";
    return trimmed;
  } catch {
    return "https://api.openai.com/v1";
  }
}
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
    if (error.status >= 422) logger.warn("request failed", { status: error.status, code: error.code });
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
import { Router as Router9 } from "express";

// ../api/src/admin/routes.ts
import { Router } from "express";
import { z as z9 } from "zod";

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
var couponScopeSchema = z2.enum(["site", "category", "subcategory", "products", "brand"]);
var couponInput = z2.object({
  id: idSchema,
  code: z2.string().trim().min(1).max(40),
  kind: z2.enum(["percent", "fixed"]),
  value: z2.number().int().positive().max(1e7),
  endsAt: z2.string().max(40),
  scope: couponScopeSchema.default("site"),
  categoryId: z2.string().trim().max(80).default(""),
  subcategoryId: z2.string().trim().max(80).default(""),
  brandId: z2.string().trim().max(80).default(""),
  productIds: z2.array(idSchema).max(200).default([])
}).superRefine((coupon, ctx) => {
  if (coupon.scope === "category" && !coupon.categoryId) {
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category" });
  }
  if (coupon.scope === "subcategory" && !coupon.subcategoryId) {
    ctx.addIssue({ code: "custom", path: ["subcategoryId"], message: "Choose a subcategory" });
  }
  if (coupon.scope === "brand" && !coupon.brandId) {
    ctx.addIssue({ code: "custom", path: ["brandId"], message: "Choose a brand" });
  }
  if (coupon.scope === "products" && coupon.productIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["productIds"], message: "Choose a product" });
  }
});
var specMap = z2.record(z2.string().max(8e3)).refine((value) => Object.keys(value).length <= 80);
var variantSchema = z2.object({
  id: idSchema,
  color: z2.string().trim().max(80),
  colorHex: z2.string().trim().max(20),
  sku: z2.string().trim().max(80).default(""),
  priceMinor: z2.number().int().min(0).max(1e8).nullable().default(null),
  subcategoryId: z2.string().max(80).default(""),
  specs: specMap.default({}),
  specsAr: specMap.default({}),
  stock: z2.number().int().min(0).max(1e6),
  active: z2.boolean(),
  onSale: z2.boolean().default(false),
  inPackages: z2.boolean().default(false),
  images: z2.array(imageSchema).max(12)
});
var fieldSchema = z2.object({
  id: idSchema,
  label: localized,
  type: fieldTypeSchema,
  section: fieldSectionSchema.default("features")
});
var productSchema = z2.object({
  id: idSchema,
  name: localized,
  priceMinor: z2.number().int().min(0).max(1e8),
  brandId: idSchema,
  categoryId: idSchema,
  subcategoryId: z2.string().max(80),
  fields: z2.array(fieldSchema).max(80).default([]),
  specs: specMap,
  specsAr: z2.record(z2.string().max(8e3)).default({}),
  variants: z2.array(variantSchema).max(20)
});
var catalogSchema = z2.object({
  categories: z2.array(
    z2.object({
      id: idSchema,
      slug: slugSchema,
      name: localized,
      image: storedImage,
      displayOrder: z2.number().int().min(0).max(9999).nullable().default(null),
      subcategories: z2.array(
        z2.object({
          id: idSchema,
          name: localized,
          image: storedImage,
          displayOrder: z2.number().int().min(0).max(9999).nullable().default(null)
        })
      ).max(40),
      fields: z2.array(fieldSchema).max(80).default([])
    })
  ).max(80),
  brands: z2.array(z2.object({ id: idSchema, slug: slugSchema, name: textSchema, image: storedImage })).max(80),
  products: z2.array(productSchema).max(200),
  coupons: z2.array(couponInput).max(100),
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
  const [categories, subcategories, fields, brands, products, specs, variants, variantSpecs, images, coupons, couponProducts, settings, zones] = await Promise.all([
    client.from("categories").select("id, slug, name_he, name_ar, image_src, sort_order, display_order").order("sort_order"),
    client.from("subcategories").select("id, category_id, name_he, name_ar, image_src, sort_order, display_order").order("sort_order"),
    client.from("product_fields").select("id, product_id, label_he, label_ar, field_type, section, sort_order").order("sort_order"),
    client.from("brands").select("id, slug, name, image_src, sort_order").order("sort_order"),
    client.from("products").select("id, name_he, name_ar, price_minor, brand_id, category_id, subcategory_id, sort_order").order("sort_order"),
    client.from("product_specs").select("product_id, field_id, value, value_ar"),
    client.from("product_variants").select("id, product_id, color, color_hex, sku, price_minor, subcategory_id, stock, is_active, on_sale, in_packages, sort_order").order("sort_order"),
    client.from("variant_specs").select("variant_id, field_id, value, value_ar"),
    client.from("variant_images").select("id, variant_id, src, sort_order").order("sort_order"),
    client.from("coupons").select("id, code, kind, value, ends_at, scope, category_id, subcategory_id, brand_id, sort_order").order("sort_order"),
    client.from("coupon_products").select("coupon_id, product_id"),
    client.from("store_settings").select("phone, accent").eq("id", true).maybeSingle(),
    client.from("shipping_zones").select("id, name, name_ar, price_minor, is_active, sort_order").order("sort_order")
  ]);
  for (const result of [categories, subcategories, fields, brands, products, specs, variants, variantSpecs, images, coupons, couponProducts, settings, zones]) {
    check(result.error);
  }
  const subsByCategory = group(subcategories.data ?? [], (row2) => row2.category_id);
  const fieldsByProduct = group(fields.data ?? [], (row2) => row2.product_id);
  const specsByProduct = group(specs.data ?? [], (row2) => row2.product_id);
  const imagesByVariant = group(images.data ?? [], (row2) => row2.variant_id);
  const specsByVariant = group(variantSpecs.data ?? [], (row2) => row2.variant_id);
  const variantsByProduct = group(variants.data ?? [], (row2) => row2.product_id);
  return {
    categories: (categories.data ?? []).map((category) => ({
      id: category.id,
      slug: category.slug,
      name: { he: category.name_he, ar: category.name_ar },
      image: category.image_src ?? "",
      displayOrder: category.display_order,
      subcategories: (subsByCategory.get(category.id) ?? []).map((item) => ({
        id: item.id,
        name: { he: item.name_he, ar: item.name_ar },
        image: item.image_src ?? "",
        displayOrder: item.display_order
      })),
      fields: []
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
      fields: (fieldsByProduct.get(product.id) ?? []).map((item) => ({
        id: item.id,
        label: { he: item.label_he, ar: item.label_ar },
        type: item.field_type,
        section: item.section === "spec" || item.section === "info" ? item.section : "features"
      })),
      specs: Object.fromEntries((specsByProduct.get(product.id) ?? []).map((item) => [item.field_id, item.value])),
      specsAr: Object.fromEntries(
        (specsByProduct.get(product.id) ?? []).filter((item) => (item.value_ar ?? "").trim()).map((item) => [item.field_id, item.value_ar ?? ""])
      ),
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        color: variant.color,
        colorHex: variant.color_hex,
        sku: variant.sku ?? "",
        priceMinor: variant.price_minor,
        subcategoryId: variant.subcategory_id ?? "",
        specs: Object.fromEntries((specsByVariant.get(variant.id) ?? []).map((item) => [item.field_id, item.value])),
        specsAr: Object.fromEntries(
          (specsByVariant.get(variant.id) ?? []).filter((item) => (item.value_ar ?? "").trim()).map((item) => [item.field_id, item.value_ar ?? ""])
        ),
        stock: variant.stock,
        active: variant.is_active,
        onSale: variant.on_sale,
        inPackages: variant.in_packages,
        images: (imagesByVariant.get(variant.id) ?? []).map((image) => ({ id: image.id, src: image.src }))
      }))
    })),
    coupons: (coupons.data ?? []).map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.value,
      endsAt: coupon.ends_at,
      scope: coupon.scope ?? "site",
      categoryId: coupon.category_id ?? "",
      subcategoryId: coupon.subcategory_id ?? "",
      brandId: coupon.brand_id ?? "",
      productIds: (couponProducts.data ?? []).filter((row2) => row2.coupon_id === coupon.id).map((row2) => row2.product_id)
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
  for (const row2 of rows) {
    const id = key(row2);
    const list = map.get(id);
    if (list) list.push(row2);
    else map.set(id, [row2]);
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
      sort_order: index,
      display_order: item.displayOrder ?? null
    }))
  );
  if (subcategories.length > 0) check((await client.from("subcategories").insert(subcategories)).error);
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
  const fields = input.products.flatMap(
    (product) => product.fields.map((item, index) => ({
      id: item.id,
      product_id: product.id,
      label_he: item.label.he,
      label_ar: item.label.ar,
      field_type: item.type,
      section: item.section,
      sort_order: index
    }))
  );
  if (fields.length > 0) check((await client.from("product_fields").insert(fields)).error);
  const variants = input.products.flatMap(
    (product) => product.variants.map((variant, index) => ({
      id: variant.id,
      product_id: product.id,
      color: variant.color,
      color_hex: variant.colorHex || "#172033",
      stock: variant.stock,
      is_active: variant.active,
      on_sale: variant.onSale,
      in_packages: variant.inPackages,
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
    (product) => Object.entries(product.specs).filter(([, value]) => value.trim()).map(([fieldId, value]) => ({
      product_id: product.id,
      field_id: fieldId,
      value,
      value_ar: product.specsAr[fieldId] ?? ""
    }))
  );
  if (specs.length > 0) check((await client.from("product_specs").insert(specs)).error);
  if (input.coupons.length > 0) {
    check(
      (await client.from("coupons").insert(input.coupons.map((coupon, index) => couponRow(coupon, index)))).error
    );
    const links = input.coupons.flatMap(
      (coupon) => coupon.scope === "products" ? coupon.productIds.map((productId) => ({ coupon_id: coupon.id, product_id: productId })) : []
    );
    if (links.length > 0) check((await client.from("coupon_products").insert(links)).error);
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
async function nextProductFieldSort(productId) {
  const { data, error } = await db().from("product_fields").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1);
  check(error);
  return (data?.[0]?.sort_order ?? -1) + 1;
}
var categoryInput = z2.object({
  id: idSchema,
  slug: slugSchema,
  nameHe: textSchema,
  nameAr: optionalText,
  image: storedImage,
  displayOrder: z2.number().int().min(0).max(9999).nullable().optional()
});
async function createCategory(input) {
  const nameAr = input.nameAr || input.nameHe;
  const { error } = await db().from("categories").insert({
    id: input.id,
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: nameAr,
    image_src: input.image,
    sort_order: await nextSort("categories"),
    display_order: input.displayOrder ?? null
  });
  check(error);
}
async function updateCategory(id, input) {
  const { error } = await db().from("categories").update({
    slug: input.slug,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image,
    display_order: input.displayOrder ?? null
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
  image: storedImage,
  displayOrder: z2.number().int().min(0).max(9999).nullable().optional()
});
async function createSubcategory(categoryId, input) {
  const { error } = await db().from("subcategories").insert({
    id: input.id,
    category_id: categoryId,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image,
    sort_order: await nextChildSort("subcategories", categoryId),
    display_order: input.displayOrder ?? null
  });
  check(error);
}
async function updateSubcategory(id, input) {
  const { error } = await db().from("subcategories").update({
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    image_src: input.image,
    display_order: input.displayOrder ?? null
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
async function createField(productId, input) {
  const { error } = await db().from("product_fields").insert({
    id: input.id,
    product_id: productId,
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section,
    sort_order: await nextProductFieldSort(productId)
  });
  check(error);
}
async function updateField(id, input) {
  const { error } = await db().from("product_fields").update({
    label_he: input.nameHe,
    label_ar: input.nameAr || input.nameHe,
    field_type: input.type,
    section: input.section
  }).eq("id", id);
  check(error);
}
async function deleteField(id) {
  const { error } = await db().from("product_fields").delete().eq("id", id);
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
  const row2 = {
    id: input.id,
    name_he: input.name.he,
    name_ar: input.name.ar,
    price_minor: input.priceMinor,
    brand_id: input.brandId,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId || null,
    sort_order: existing.data?.sort_order ?? await nextSort("products")
  };
  check((await client.from("products").upsert(row2)).error);
  check((await client.from("product_specs").delete().eq("product_id", input.id)).error);
  check((await client.from("product_variants").delete().eq("product_id", input.id)).error);
  check((await client.from("product_fields").delete().eq("product_id", input.id)).error);
  if (input.fields.length > 0) {
    check(
      (await client.from("product_fields").insert(
        input.fields.map((field, index) => ({
          id: field.id,
          product_id: input.id,
          label_he: field.label.he,
          label_ar: field.label.ar,
          field_type: field.type,
          section: field.section,
          sort_order: index
        }))
      )).error
    );
  }
  if (input.variants.length > 0) {
    check(
      (await client.from("product_variants").insert(
        input.variants.map((variant, index) => ({
          id: variant.id,
          product_id: input.id,
          color: variant.color,
          color_hex: variant.colorHex || "#172033",
          sku: variant.sku,
          price_minor: variant.priceMinor,
          subcategory_id: variant.subcategoryId || null,
          stock: variant.stock,
          is_active: variant.active,
          on_sale: variant.onSale,
          in_packages: variant.inPackages,
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
  const specs = Object.entries(input.specs).filter(([, value]) => value.trim()).map(([fieldId, value]) => ({
    product_id: input.id,
    field_id: fieldId,
    value,
    value_ar: input.specsAr[fieldId] ?? ""
  }));
  if (specs.length > 0) check((await client.from("product_specs").insert(specs)).error);
  const variantSpecRows = input.variants.flatMap(
    (variant) => Object.entries(variant.specs).filter(([, value]) => value.trim()).map(([fieldId, value]) => ({
      variant_id: variant.id,
      field_id: fieldId,
      value,
      value_ar: variant.specsAr[fieldId] ?? ""
    }))
  );
  if (variantSpecRows.length > 0) check((await client.from("variant_specs").insert(variantSpecRows)).error);
}
async function deleteProduct(id) {
  const { error } = await db().from("products").delete().eq("id", id);
  check(error);
}
function couponRow(coupon, sortOrder) {
  return {
    id: coupon.id,
    code: coupon.code.toUpperCase(),
    kind: coupon.kind,
    value: coupon.value,
    ends_at: coupon.endsAt,
    scope: coupon.scope,
    category_id: coupon.scope === "category" || coupon.scope === "subcategory" ? coupon.categoryId || null : null,
    subcategory_id: coupon.scope === "subcategory" ? coupon.subcategoryId || null : null,
    brand_id: coupon.scope === "brand" ? coupon.brandId || null : null,
    sort_order: sortOrder
  };
}
async function saveCoupon(input) {
  const existing = await db().from("coupons").select("sort_order").eq("id", input.id).maybeSingle();
  check(existing.error);
  const { error } = await db().from("coupons").upsert(couponRow(input, existing.data?.sort_order ?? await nextSort("coupons")));
  check(error);
  const cleared = await db().from("coupon_products").delete().eq("coupon_id", input.id);
  check(cleared.error);
  if (input.scope === "products" && input.productIds.length > 0) {
    const linked = await db().from("coupon_products").insert(
      input.productIds.map((productId) => ({ coupon_id: input.id, product_id: productId }))
    );
    check(linked.error);
  }
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
import { z as z5 } from "zod";

// ../../packages/shared/src/money.ts
var ILS = "ILS";
function ils(amountMinor) {
  return { amountMinor, currency: ILS };
}
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
function formatMoney(money3, locale) {
  return formatters[locale].format(money3.amountMinor / 100);
}

// ../../packages/shared/src/schemas/health.ts
import { z as z3 } from "zod";
var healthResponseSchema = z3.object({
  status: z3.literal("ok"),
  service: z3.literal("anan-api"),
  version: z3.string().min(1),
  timestamp: z3.string().datetime(),
  supabase: z3.enum(["configured", "not_configured"])
});

// ../../packages/shared/src/admin.ts
var adminEmails = ["salonanan24@gmail.com"];
function isAdminEmail(email) {
  const folded = email?.trim().toLowerCase() ?? "";
  return adminEmails.some((item) => item === folded);
}

// ../../packages/shared/src/schemas/coupon.ts
import { z as z4 } from "zod";
var couponCodeSchema = z4.object({
  code: z4.string().trim().min(4).max(20).regex(/^[A-Za-z0-9-]+$/)
});

// ../api/src/mail/send.ts
function mailFrom(displayName) {
  const raw = config.resendFrom;
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] ?? raw).trim();
  return `${displayName} <${email}>`;
}
async function sendMail(input) {
  if (!config.resendApiKey) {
    logger.warn("mail skipped, RESEND_API_KEY is empty");
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: mailFrom(input.fromName),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...input.replyTo ? { reply_to: input.replyTo } : {}
      }),
      signal: AbortSignal.timeout(12e3)
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error("mail failed", { status: response.status, body: body.slice(0, 400) });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("mail failed", { message: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}

// ../api/src/mail/letters.ts
var storeName = {
  he: "\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF",
  ar: "\u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646"
};
function esc(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(minor, locale) {
  return formatMoney(ils(minor), locale);
}
function when(iso, locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    numberingSystem: "latn"
  }).format(date);
}
var rtlStyle = "direction:rtl;text-align:right;";
function page(locale, body) {
  return `<!doctype html>
<html lang="${locale}" dir="rtl">
<body dir="rtl" style="margin:0;background:#f4f6f8;color:#172033;font-family:Arial,Helvetica,sans-serif;${rtlStyle}">
  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;${rtlStyle}">
    <tr><td dir="rtl" align="center" style="padding:24px 12px;${rtlStyle}">
      <table dir="rtl" role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;${rtlStyle}">
        <tr><td dir="rtl" align="right" style="background:#0c5695;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:700;${rtlStyle}">&#x200F;${esc(storeName[locale])}</td></tr>
        <tr><td dir="rtl" align="right" style="padding:24px;font-size:15px;line-height:1.7;${rtlStyle}">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function ltr(value) {
  return `<span dir="ltr" style="direction:ltr;unicode-bidi:isolate;">${esc(value)}</span>`;
}
function text(value) {
  return /[A-Za-z0-9@]/.test(value) ? ltr(value) : esc(value);
}
function paragraph(html, extra = "margin:0 0 12px;") {
  return `<p dir="rtl" style="${extra}${rtlStyle}">&#x200F;${html}</p>`;
}
function greeting(locale, name) {
  const safe = name.trim();
  if (locale === "ar") return safe ? `\u0645\u0631\u062D\u0628\u0627\u064B ${ltr(safe)}\u060C` : "\u0645\u0631\u062D\u0628\u0627\u064B\u060C";
  return safe ? `\u05E9\u05DC\u05D5\u05DD ${ltr(safe)},` : "\u05E9\u05DC\u05D5\u05DD,";
}
function row(label, value) {
  if (!value) return "";
  return `<tr>
    <td dir="rtl" align="right" style="padding:6px 0;color:#5c6775;${rtlStyle}">&#x200F;${esc(label)}</td>
    <td dir="rtl" align="left" style="padding:6px 0;font-weight:700;direction:rtl;text-align:left;">${text(value)}</td>
  </tr>`;
}
function linesTable(order, locale) {
  const rows = order.items.map((item) => {
    const name = item.name[locale] || item.name.he;
    return `<tr>
        <td dir="rtl" align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;${rtlStyle}">&#x200F;${esc(name)} \xD7 ${ltr(String(item.quantity))}</td>
        <td dir="ltr" align="left" style="padding:8px 0;border-bottom:1px solid #e5e7eb;direction:ltr;text-align:left;font-weight:700;">${ltr(money(item.lineTotalMinor, locale))}</td>
      </tr>`;
  }).join("");
  const deliveryLabel = order.deliveryMethod === "pickup" ? locale === "ar" ? "\u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645" : "\u05D0\u05D9\u05E1\u05D5\u05E3" : locale === "ar" ? "\u0627\u0644\u062A\u0648\u0635\u064A\u0644" : "\u05DE\u05E9\u05DC\u05D5\u05D7";
  const deliveryValue = order.deliveryMinor === 0 ? locale === "ar" ? "\u0628\u062F\u0648\u0646 \u062A\u0643\u0644\u0641\u0629" : "\u05DC\u05DC\u05D0 \u05E2\u05DC\u05D5\u05EA" : money(order.deliveryMinor, locale);
  return `<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;${rtlStyle}">
    ${rows}
    ${row(locale === "ar" ? "\u0627\u0644\u0645\u062C\u0645\u0648\u0639" : "\u05E1\u05DB\u05D5\u05DD \u05D1\u05D9\u05E0\u05D9\u05D9\u05DD", money(order.subtotalMinor, locale))}
    ${order.discountMinor > 0 ? row(locale === "ar" ? "\u0627\u0644\u062E\u0635\u0645" : "\u05D4\u05E0\u05D7\u05D4", money(order.discountMinor, locale)) : ""}
    ${row(deliveryLabel, deliveryValue)}
    ${row(locale === "ar" ? "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" : "\u05E1\u05D4\u05F4\u05DB", money(order.totalMinor, locale))}
  </table>`;
}
function deliveryText(order, locale) {
  if (order.deliveryMethod === "pickup") return locale === "ar" ? "\u0627\u0633\u062A\u0644\u0627\u0645 \u0630\u0627\u062A\u064A \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631" : "\u05D0\u05D9\u05E1\u05D5\u05E3 \u05E2\u05E6\u05DE\u05D9 \u05DE\u05D4\u05D7\u05E0\u05D5\u05EA";
  return [locale === "ar" ? "\u062A\u0648\u0635\u064A\u0644 \u062D\u062A\u0649 \u0627\u0644\u0628\u064A\u062A" : "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E2\u05D3 \u05D4\u05D1\u05D9\u05EA", order.shippingAddress].filter(Boolean).join(" \u2014 ");
}
function orderFacts(order, locale) {
  return `<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;${rtlStyle}">
    ${row(locale === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628" : "\u05DE\u05E1\u05E4\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4", order.number)}
    ${row(locale === "ar" ? "\u0627\u0644\u062A\u0627\u0631\u064A\u062E" : "\u05EA\u05D0\u05E8\u05D9\u05DA", when(order.placedAt, locale))}
    ${row(locale === "ar" ? "\u0627\u0644\u062A\u0633\u0644\u064A\u0645" : "\u05D0\u05E1\u05E4\u05E7\u05D4", deliveryText(order, locale))}
    ${order.shippingZone ? row(locale === "ar" ? "\u0627\u0644\u0645\u0646\u0637\u0642\u0629" : "\u05D0\u05D6\u05D5\u05E8", order.shippingZone) : ""}
    ${order.couponCode ? row(locale === "ar" ? "\u0642\u0633\u064A\u0645\u0629" : "\u05E7\u05D5\u05E4\u05D5\u05DF", order.couponCode) : ""}
    ${order.note ? row(locale === "ar" ? "\u0645\u0644\u0627\u062D\u0638\u0629" : "\u05D4\u05E2\u05E8\u05D4", order.note) : ""}
  </table>
  ${linesTable(order, locale)}`;
}
var statusCopy = {
  placed: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4 \u05D5\u05D0\u05E0\u05D7\u05E0\u05D5 \u05DE\u05D8\u05E4\u05DC\u05D9\u05DD \u05D1\u05D4." },
    ar: { subject: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 {number}", lead: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0648\u0646\u062D\u0646 \u0646\u062A\u0627\u0628\u0639 \u0645\u0639\u0627\u0644\u062C\u062A\u0647." }
  },
  processing: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05D1\u05D8\u05D9\u05E4\u05D5\u05DC", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05E2\u05D1\u05E8\u05D4 \u05DC\u05D8\u05D9\u05E4\u05D5\u05DC." },
    ar: { subject: "\u0627\u0644\u0637\u0644\u0628 {number} \u0642\u064A\u062F \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629", lead: "\u0637\u0644\u0628\u0643 \u0623\u0635\u0628\u062D \u0642\u064A\u062F \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629." }
  },
  ready: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05DE\u05D5\u05DB\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05DE\u05D5\u05DB\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3 \u05E2\u05E6\u05DE\u05D9 \u05DE\u05D4\u05D7\u05E0\u05D5\u05EA." },
    ar: { subject: "\u0627\u0644\u0637\u0644\u0628 {number} \u062C\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062A\u0644\u0627\u0645", lead: "\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0630\u0627\u062A\u064A \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631." }
  },
  shipping: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05D1\u05D3\u05E8\u05DA \u05D0\u05DC\u05D9\u05DA", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05D9\u05E6\u05D0\u05D4 \u05DC\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E2\u05D3 \u05D4\u05D1\u05D9\u05EA." },
    ar: { subject: "\u0627\u0644\u0637\u0644\u0628 {number} \u0642\u064A\u062F \u0627\u0644\u062A\u0648\u0635\u064A\u0644", lead: "\u062E\u0631\u062C \u0637\u0644\u0628\u0643 \u0644\u0644\u062A\u0648\u0635\u064A\u0644 \u062D\u062A\u0649 \u0627\u0644\u0628\u064A\u062A." }
  },
  completed: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05D4\u05D5\u05E9\u05DC\u05DE\u05D4", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05D4\u05D5\u05E9\u05DC\u05DE\u05D4. \u05EA\u05D5\u05D3\u05D4 \u05E9\u05E7\u05E0\u05D9\u05EA \u05D1\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF." },
    ar: { subject: "\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0637\u0644\u0628 {number}", lead: "\u0627\u0643\u062A\u0645\u0644 \u0637\u0644\u0628\u0643. \u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643 \u0645\u0646 \u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646." }
  },
  cancelled: {
    he: { subject: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 {number} \u05D1\u05D5\u05D8\u05DC\u05D4", lead: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC\u05DA \u05D1\u05D5\u05D8\u05DC\u05D4. \u05D0\u05DD \u05D6\u05D4 \u05DC\u05D0 \u05DE\u05D4 \u05E9\u05D1\u05D9\u05E7\u05E9\u05EA, \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05E9\u05D9\u05D1 \u05DC\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4." },
    ar: { subject: "\u0623\u064F\u0644\u063A\u064A \u0627\u0644\u0637\u0644\u0628 {number}", lead: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628\u0643. \u0625\u0630\u0627 \u0644\u0645 \u064A\u0643\u0646 \u0647\u0630\u0627 \u0645\u0627 \u0637\u0644\u0628\u062A\u0647\u060C \u064A\u0645\u0643\u0646 \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F." }
  }
};
async function sendWelcome(email, maxAgeMs = 30 * 60 * 1e3) {
  if (!isSupabaseConfigured()) return;
  const user = await findUser(email);
  if (!user?.email) return;
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(created) || Date.now() - created > maxAgeMs) return;
  const meta = user.user_metadata ?? {};
  if (meta.welcome_sent === true) return;
  const locale = meta.preferred_locale === "ar" ? "ar" : "he";
  const name = typeof meta.full_name === "string" ? meta.full_name : "";
  const subject = locale === "ar" ? "\u0623\u0647\u0644\u0627\u064B \u0628\u0643 \u0641\u064A \u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646" : "\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF";
  const lead = locale === "ar" ? "\u064A\u0633\u0639\u062F\u0646\u0627 \u0627\u0646\u0636\u0645\u0627\u0645\u0643 \u0625\u0644\u0649 \u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646. \u064A\u0645\u0643\u0646\u0643 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062D\u0633\u0627\u0628\u060C \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0634\u0631\u0627\u0621 \u0623\u062C\u0647\u0632\u0629 \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0644\u0644\u0628\u064A\u062A." : "\u05E9\u05DE\u05D7\u05D9\u05DD \u05E9\u05D4\u05E6\u05D8\u05E8\u05E4\u05EA \u05DC\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF, \u05DC\u05E2\u05E7\u05D5\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D5\u05DC\u05E7\u05E0\u05D5\u05EA \u05DE\u05D5\u05E6\u05E8\u05D9 \u05D7\u05E9\u05DE\u05DC \u05DC\u05D1\u05D9\u05EA.";
  const ignore = locale === "ar" ? "\u0625\u0630\u0627 \u0644\u0645 \u062A\u0642\u0645 \u0628\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628\u060C \u064A\u0645\u0643\u0646 \u062A\u062C\u0627\u0647\u0644 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629." : "\u05D0\u05DD \u05DC\u05D0 \u05D9\u05E6\u05E8\u05EA \u05D0\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF, \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05EA\u05E2\u05DC\u05DD \u05DE\u05D4\u05DE\u05D9\u05D9\u05DC \u05D4\u05D6\u05D4.";
  const html = page(
    locale,
    `${paragraph(greeting(locale, name), "margin:0 0 12px;font-size:18px;font-weight:700;")}
     ${paragraph(lead)}
     ${paragraph(ignore, "margin:0;color:#5c6775;")}`
  );
  const sent = await sendMail({ to: user.email, subject, html, fromName: storeName[locale] });
  if (!sent) return;
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, welcome_sent: true }
  });
  if (updated.error) logger.warn("welcome flag was not saved");
}
async function sendOrderPlaced(order) {
  const locale = order.locale;
  const subject = locale === "ar" ? `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 ${order.number}` : `\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 ${order.number} \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4`;
  const lead = locale === "ar" ? "\u0634\u0643\u0631\u0627\u064B \u0644\u0637\u0644\u0628\u0643 \u0645\u0646 \u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646. \u0627\u0633\u062A\u0644\u0645\u0646\u0627 \u0627\u0644\u0637\u0644\u0628 \u0648\u0633\u0646\u0631\u0633\u0644 \u0644\u0643 \u0628\u0631\u064A\u062F\u0627\u064B \u0639\u0646\u062F \u062A\u063A\u064A\u0651\u0631 \u062D\u0627\u0644\u062A\u0647." : "\u05EA\u05D5\u05D3\u05D4 \u05E2\u05DC \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF. \u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05D5\u05EA\u05D4 \u05D5\u05E0\u05E9\u05DC\u05D7 \u05E2\u05D3\u05DB\u05D5\u05DF \u05DB\u05E9\u05D4\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D9\u05E9\u05EA\u05E0\u05D4.";
  const customerHtml = page(
    locale,
    `${paragraph(greeting(locale, order.customerName), "margin:0 0 12px;font-size:18px;font-weight:700;")}
     ${paragraph(lead, "margin:0;")}
     ${orderFacts(order, locale)}`
  );
  const adminHtml = page(
    "he",
    `${paragraph("\u05D4\u05EA\u05E7\u05D1\u05DC\u05D4 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05D7\u05D3\u05E9\u05D4", "margin:0 0 12px;font-size:18px;font-weight:700;")}
     <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${rtlStyle}">
       ${row("\u05DC\u05E7\u05D5\u05D7", order.customerName)}
       ${row("\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", order.customerEmail)}
       ${row("\u05D8\u05DC\u05E4\u05D5\u05DF", order.customerPhone)}
       ${row("\u05E9\u05E4\u05EA \u05D4\u05D0\u05EA\u05E8", locale === "ar" ? "\u05E2\u05E8\u05D1\u05D9\u05EA" : "\u05E2\u05D1\u05E8\u05D9\u05EA")}
     </table>
     ${orderFacts(order, "he")}`
  );
  await Promise.all([
    sendMail({ to: order.customerEmail, subject, html: customerHtml, fromName: storeName[locale] }),
    ...adminEmails.map(
      (to) => sendMail({ to, subject: `\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D7\u05D3\u05E9\u05D4 ${order.number}`, html: adminHtml, fromName: storeName.he })
    )
  ]);
}
async function sendSiteInquiry(input) {
  const name = input.name.replace(/[\r\n]/g, " ").trim();
  const html = page(
    "he",
    `${paragraph("\u05E4\u05E0\u05D9\u05D9\u05D4 \u05DE\u05D4\u05D0\u05EA\u05E8", "margin:0 0 12px;font-size:18px;font-weight:700;")}
     <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${rtlStyle}">
       ${row("\u05E9\u05DD", name)}
       ${row("\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", input.email)}
       ${row("\u05D8\u05DC\u05E4\u05D5\u05DF", input.phone)}
     </table>
     <div dir="rtl" style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;white-space:pre-wrap;${rtlStyle}">&#x200F;${esc(input.message)}</div>`
  );
  const results = await Promise.all(
    adminEmails.map(
      (to) => sendMail({
        to,
        subject: `\u05E4\u05E0\u05D9\u05D9\u05D4 \u05DE\u05D4\u05D0\u05EA\u05E8 \u2014 ${name}`,
        html,
        fromName: storeName.he,
        replyTo: input.email
      })
    )
  );
  return results.some(Boolean);
}
async function sendPasswordCodeMail(email, code, locale) {
  const subject = locale === "ar" ? "\u0631\u0645\u0632 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" : "\u05E7\u05D5\u05D3 \u05DC\u05D0\u05D9\u05E4\u05D5\u05E1 \u05D4\u05E1\u05D9\u05E1\u05DE\u05D4";
  const lead = locale === "ar" ? "\u0627\u0633\u062A\u062E\u062F\u0645\u0648\u0627 \u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632 \u0644\u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 \u0641\u064A \u0645\u0639\u0631\u0636 \u0639\u0646\u0627\u0646. \u0627\u0644\u0631\u0645\u0632 \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 5 \u062F\u0642\u0627\u0626\u0642." : "\u05D4\u05E9\u05EA\u05DE\u05E9\u05D5 \u05D1\u05E7\u05D5\u05D3 \u05D4\u05D6\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF \u05E2\u05E0\u05D0\u05DF. \u05D4\u05E7\u05D5\u05D3 \u05EA\u05E7\u05E3 \u05DC\u05BE5 \u05D3\u05E7\u05D5\u05EA.";
  const html = page(
    locale,
    `${paragraph(lead, "margin:0;")}
     <p dir="ltr" style="margin:20px 0 0;font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;direction:ltr;">${esc(code)}</p>`
  );
  return sendMail({ to: email, subject, html, fromName: storeName[locale] });
}
async function sendOrderStatus(order) {
  const locale = order.locale;
  const copy = statusCopy[order.status][locale];
  const numberLabel = locale === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628" : "\u05DE\u05E1\u05E4\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4";
  const html = page(
    locale,
    `${paragraph(greeting(locale, order.customerName), "margin:0 0 12px;font-size:18px;font-weight:700;")}
     ${paragraph(copy.lead, "margin:0;")}
     <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;${rtlStyle}">
       ${row(numberLabel, order.number)}
     </table>`
  );
  await sendMail({
    to: order.customerEmail,
    subject: copy.subject.replace("{number}", order.number),
    html,
    fromName: storeName[locale]
  });
}
async function findUser(email) {
  const target = email.trim().toLowerCase();
  for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
    const result = await getSupabaseAdmin().auth.admin.listUsers({ page: pageNumber, perPage: 200 });
    if (result.error) {
      logger.error("welcome lookup failed");
      return null;
    }
    const found = result.data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (result.data.users.length < 200) return null;
  }
  return null;
}

// ../api/src/orders/orders.ts
var lineSchema = z5.object({
  productId: z5.string().trim().min(1).max(80),
  variantId: z5.string().trim().max(80).default(""),
  quantity: z5.number().int().min(1).max(10)
});
var quoteSchema = z5.object({
  lines: z5.array(lineSchema).min(1).max(30),
  couponCode: z5.string().trim().max(40).default("")
});
var placeSchema = quoteSchema.extend({
  note: z5.string().trim().max(500).default(""),
  customer: z5.object({
    name: z5.string().trim().min(2).max(80),
    email: z5.string().trim().email().max(160),
    phone: z5.string().trim().min(8).max(30)
  }),
  locale: z5.enum(["he", "ar"]).default("he"),
  delivery: z5.object({
    method: z5.enum(["pickup", "home"]),
    zoneId: z5.string().trim().max(80).default(""),
    city: z5.string().trim().max(80).default(""),
    street: z5.string().trim().max(120).default(""),
    house: z5.string().trim().max(20).default(""),
    apartment: z5.string().trim().max(20).default("")
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
  const products = await db2().from("products").select("id, name_he, name_ar, price_minor, category_id, subcategory_id, brand_id").in("id", ids);
  if (products.error) throw new AppError(500, "database", "Database write failed");
  const variants = await db2().from("product_variants").select("id, product_id, color, sku, price_minor, subcategory_id, stock, is_active, sort_order").in("product_id", ids).order("sort_order");
  if (variants.error) throw new AppError(500, "database", "Database write failed");
  const variantIds = (variants.data ?? []).map((variant) => variant.id);
  const images = variantIds.length === 0 ? { data: [], error: null } : await db2().from("variant_images").select("variant_id, src, sort_order").in("variant_id", variantIds).order("sort_order");
  if (images.error) throw new AppError(500, "database", "Database write failed");
  const specRows = variantIds.length === 0 ? { data: [], error: null } : await db2().from("variant_specs").select("variant_id, value").in("variant_id", variantIds);
  if (specRows.error) throw new AppError(500, "database", "Database write failed");
  return lines.map((line) => {
    const product = (products.data ?? []).find((item) => item.id === line.productId);
    if (!product) throw new AppError(400, "missing_product", "A cart product is no longer available");
    const choices = (variants.data ?? []).filter((variant2) => variant2.product_id === product.id && variant2.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const requested = line.variantId ? choices.find((item) => item.id === line.variantId) : void 0;
    const variant = requested ?? choices.find((item) => item.stock >= line.quantity) ?? choices[0];
    if (!variant || variant.stock < line.quantity) {
      throw new AppError(409, "stock", "Not enough stock");
    }
    const image = (images.data ?? []).find((item) => item.variant_id === variant.id)?.src ?? (images.data ?? []).find((item) => choices.some((choice) => choice.id === item.variant_id))?.src ?? "";
    const unitPriceMinor = variant.price_minor ?? product.price_minor;
    const size = variant.color.trim();
    const model = (specRows.data ?? []).find((row2) => row2.variant_id === variant.id && /[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/.test(row2.value ?? ""))?.value.match(/[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/)?.[0] ?? "";
    const withSize = (name) => {
      const sized = size && !name.includes(size) ? `${name} ${size}` : name;
      return model && !sized.includes(model) ? `${sized} ${model}` : sized;
    };
    return {
      productId: product.id,
      variantId: variant.id,
      categoryId: product.category_id,
      subcategoryId: variant.subcategory_id || product.subcategory_id || "",
      brandId: product.brand_id,
      name: {
        he: withSize(product.name_he),
        ar: withSize(product.name_ar)
      },
      image,
      unitPriceMinor,
      quantity: line.quantity,
      lineTotalMinor: unitPriceMinor * line.quantity,
      stock: variant.stock
    };
  });
}
async function discountFor(lines, couponCode) {
  const code = couponCode.trim().toUpperCase();
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  if (!code) return { code: "", discountMinor: 0 };
  const coupon = await db2().from("coupons").select("id, code, kind, value, ends_at, scope, category_id, subcategory_id, brand_id").eq("code", code).maybeSingle();
  if (coupon.error) throw new AppError(500, "database", "Database write failed");
  if (!coupon.data) throw new AppError(400, "coupon", "Coupon was not found");
  if (coupon.data.ends_at && coupon.data.ends_at < (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
    throw new AppError(400, "coupon", "Coupon was not found");
  }
  const links = coupon.data.scope === "products" ? await db2().from("coupon_products").select("product_id").eq("coupon_id", coupon.data.id) : { data: [], error: null };
  if (links.error) throw new AppError(500, "database", "Database write failed");
  const productIds = new Set((links.data ?? []).map((row2) => row2.product_id));
  const eligibleMinor = lines.reduce((sum, line) => {
    const scope = coupon.data?.scope ?? "site";
    const matches = scope === "site" || scope === "category" && Boolean(coupon.data?.category_id) && line.categoryId === coupon.data?.category_id || scope === "subcategory" && Boolean(coupon.data?.subcategory_id) && line.subcategoryId === coupon.data?.subcategory_id || scope === "brand" && Boolean(coupon.data?.brand_id) && line.brandId === coupon.data?.brand_id || scope === "products" && productIds.has(line.productId);
    return matches ? sum + line.lineTotalMinor : sum;
  }, 0);
  if (eligibleMinor <= 0) throw new AppError(400, "coupon_scope", "Coupon does not apply to this cart");
  const discountMinor = coupon.data.kind === "percent" ? Math.min(subtotalMinor, Math.round(eligibleMinor * coupon.data.value / 100)) : Math.min(eligibleMinor, coupon.data.value);
  return { code: coupon.data.code, discountMinor };
}
async function quoteOrder(input) {
  const lines = await pricedLines(input.lines);
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const coupon = await discountFor(lines, input.couponCode);
  return {
    subtotalMinor,
    discountMinor: coupon.discountMinor,
    totalMinor: subtotalMinor - coupon.discountMinor,
    couponCode: coupon.code
  };
}
function mapOrder(row2, items) {
  return {
    id: String(row2.id),
    number: String(row2.number),
    placedAt: String(row2.placed_at),
    status: row2.status,
    subtotalMinor: Number(row2.subtotal_minor),
    discountMinor: Number(row2.discount_minor),
    totalMinor: Number(row2.total_minor),
    couponCode: String(row2.coupon_code ?? ""),
    note: String(row2.note ?? ""),
    deliveryMethod: row2.delivery_method === "home" ? "home" : "pickup",
    deliveryMinor: Number(row2.delivery_minor ?? 0),
    shippingZone: String(row2.shipping_zone ?? ""),
    shippingAddress: String(row2.shipping_address ?? ""),
    customerName: String(row2.customer_name ?? ""),
    customerEmail: String(row2.customer_email ?? ""),
    customerPhone: String(row2.customer_phone ?? ""),
    locale: row2.locale === "ar" ? "ar" : "he",
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
  const coupon = await discountFor(lines, input.couponCode);
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
  const order = mapOrder(inserted.data, itemRows.map((item) => ({
    id: item.id,
    name: { he: item.product_name_he, ar: item.product_name_ar },
    quantity: item.quantity,
    unitPriceMinor: item.unit_price_minor,
    lineTotalMinor: item.line_total_minor,
    image: item.image_src
  })));
  try {
    await sendOrderPlaced(mailOrder(order));
  } catch (error) {
    logger.error("order mail failed", { message: error instanceof Error ? error.message : "unknown" });
  }
  return order;
}
async function listOrdersForUser(userId, email) {
  const byId = await db2().from("orders").select("*").eq("customer_id", userId).order("placed_at", { ascending: false });
  if (byId.error) throw new AppError(500, "database", "Database write failed");
  const byEmail = email ? await db2().from("orders").select("*").ilike("customer_email", email).order("placed_at", { ascending: false }) : { data: [], error: null };
  if (byEmail.error) throw new AppError(500, "database", "Database write failed");
  const rows = [...byId.data ?? [], ...byEmail.data ?? []];
  const unique = [...new Map(rows.map((row2) => [row2.id, row2])).values()];
  const items = await itemsFor(unique.map((row2) => row2.id));
  return unique.map((row2) => mapOrder(row2, items.get(row2.id) ?? []));
}
async function orderForUser(id, userId, email) {
  const orders = await listOrdersForUser(userId, email);
  const order = orders.find((item) => item.id === id);
  if (!order) throw new AppError(404, "not_found", "Order was not found");
  return order;
}
var orderStatusSchema = z5.enum(["placed", "processing", "ready", "shipping", "completed", "cancelled"]);
async function updateOrderStatus(id, status) {
  const current = await db2().from("orders").select("id, delivery_method, status").eq("id", id).maybeSingle();
  if (current.error) throw new AppError(500, "database", "Database write failed");
  if (!current.data) throw new AppError(404, "not_found", "Order was not found");
  const home = current.data.delivery_method === "home";
  if (status === "ready" && home) throw new AppError(400, "status", "Ready is only for store pickup");
  if (status === "shipping" && !home) throw new AppError(400, "status", "Shipping is only for home delivery");
  if (current.data.status === status) return;
  const result = await db2().from("orders").update({ status }).eq("id", id).select("id").maybeSingle();
  if (result.error) throw new AppError(500, "database", "Database write failed");
  if (!result.data) throw new AppError(404, "not_found", "Order was not found");
  try {
    await sendOrderStatus(mailOrder(await storedOrder(id)));
  } catch (error) {
    logger.error("status mail failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}
async function storedOrder(id) {
  const result = await db2().from("orders").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new AppError(500, "database", "Database write failed");
  if (!result.data) throw new AppError(404, "not_found", "Order was not found");
  const items = await itemsFor([id]);
  return mapOrder(result.data, items.get(id) ?? []);
}
function mailOrder(order) {
  return {
    number: order.number,
    placedAt: order.placedAt,
    status: order.status,
    locale: order.locale,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    deliveryMinor: order.deliveryMinor,
    totalMinor: order.totalMinor,
    couponCode: order.couponCode,
    note: order.note,
    deliveryMethod: order.deliveryMethod,
    shippingZone: order.shippingZone,
    shippingAddress: order.shippingAddress,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      lineTotalMinor: item.lineTotalMinor
    }))
  };
}
async function countRegisteredCustomers() {
  let page2 = 1;
  let total = 0;
  for (; ; ) {
    const result = await db2().auth.admin.listUsers({ page: page2, perPage: 200 });
    if (result.error) throw new AppError(500, "database", "Database write failed");
    const batch = result.data.users.length;
    total += batch;
    if (batch < 200 || page2 >= 20) break;
    page2 += 1;
  }
  return total;
}
async function listAllOrders() {
  const result = await db2().from("orders").select("*").order("placed_at", { ascending: false });
  if (result.error) throw new AppError(500, "database", "Database write failed");
  const rows = result.data ?? [];
  const items = await itemsFor(rows.map((row2) => row2.id));
  return rows.map((row2) => mapOrder(row2, items.get(row2.id) ?? []));
}

// ../api/src/home-ads/home-ads.ts
import { z as z6 } from "zod";
var targetKind = z6.enum(["none", "category", "subcategory", "brand", "product", "package"]);
var placementSchema = z6.enum(["hero", "square", "section", "packages"]);
var sectionKeys = ["featured", "fridges", "laundry", "entertainment", "tech", "kitchen"];
var sectionSchema = z6.enum(sectionKeys);
var layoutSchema = z6.enum(["above", "beside"]);
var targetRef = z6.string().trim().max(80).refine((value) => value === "" || /^[a-zA-Z0-9_-]{1,80}$/.test(value), "target");
var imageSchema2 = z6.string().trim().min(1).max(2e6).refine(isSafeImage, "image");
var homeAdsInput = z6.object({
  ads: z6.array(
    z6.object({
      id: idSchema,
      image: imageSchema2,
      targetKind,
      targetRef,
      section: sectionSchema.optional(),
      layout: layoutSchema.optional()
    })
  ).max(12),
  placement: placementSchema.default("hero")
}).superRefine((body, ctx) => {
  if (body.placement !== "section") return;
  const seen = /* @__PURE__ */ new Set();
  body.ads.forEach((ad, index) => {
    if (!ad.section || !ad.layout) {
      ctx.addIssue({ code: "custom", path: ["ads", index], message: "section" });
      return;
    }
    if (seen.has(ad.section)) ctx.addIssue({ code: "custom", path: ["ads", index, "section"], message: "duplicate" });
    seen.add(ad.section);
  });
});
function db3() {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  return getSupabaseAdmin();
}
function fail2(error) {
  if (!error) return;
  throw new AppError(500, "database", "Database write failed");
}
function isSafeImage(value) {
  if (value.startsWith("data:image/jpeg;base64,") || value.startsWith("data:image/png;base64,") || value.startsWith("data:image/webp;base64,")) {
    return true;
  }
  if (value.startsWith("/") && !value.includes("..") && !value.includes("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
async function listHomeAds(placement = "hero") {
  const result = await db3().from("home_ads").select("id, image_src, target_kind, target_ref, sort_order, placement, section, layout").eq("placement", placement).order("sort_order");
  fail2(result.error);
  return (result.data ?? []).map((row2) => {
    const ref = row2.target_ref ?? "";
    const kind = targetKind.parse(row2.target_kind);
    const section = sectionSchema.safeParse(row2.section);
    const layout = layoutSchema.safeParse(row2.layout);
    return {
      id: row2.id,
      image: row2.image_src,
      targetKind: ref ? kind : "none",
      targetRef: ref && kind !== "none" ? ref : "",
      ...section.success ? { section: section.data } : {},
      ...layout.success ? { layout: layout.data } : {}
    };
  });
}
async function replaceHomeAds(ads, placement = "hero") {
  const client = db3();
  const existing = await client.from("home_ads").select("id").eq("placement", placement);
  fail2(existing.error);
  const keep = new Set(ads.map((ad) => ad.id));
  const remove = (existing.data ?? []).map((row2) => row2.id).filter((id) => !keep.has(id));
  if (remove.length > 0) {
    fail2((await client.from("home_ads").delete().in("id", remove)).error);
  }
  if (ads.length === 0) return;
  fail2(
    (await client.from("home_ads").upsert(
      ads.map((ad, index) => ({
        id: ad.id,
        image_src: ad.image,
        target_kind: ad.targetRef && ad.targetKind !== "none" ? ad.targetKind : "none",
        target_ref: ad.targetRef && ad.targetKind !== "none" ? ad.targetRef : "",
        placement,
        section: placement === "section" ? ad.section ?? null : null,
        layout: placement === "section" ? ad.layout ?? null : null,
        sort_order: index
      }))
    )).error
  );
}

// ../api/src/packages/packages.ts
import { z as z7 } from "zod";
var textSchema2 = z7.string().trim().min(1).max(200);
var optionalText2 = z7.string().trim().max(200);
var packageInput = z7.object({
  id: idSchema,
  nameHe: textSchema2,
  nameAr: optionalText2,
  priceMinor: z7.number().int().min(0).max(1e7),
  active: z7.boolean(),
  productIds: z7.array(idSchema).min(2).max(30)
});
function db4() {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  return getSupabaseAdmin();
}
function fail3(error) {
  if (!error) return;
  throw new AppError(500, "database", "Database write failed");
}
async function itemsByPackage(ids) {
  const grouped = /* @__PURE__ */ new Map();
  if (ids.length === 0) return grouped;
  const result = await db4().from("package_items").select("package_id, product_id").in("package_id", ids);
  fail3(result.error);
  for (const row2 of result.data ?? []) {
    const list = grouped.get(row2.package_id) ?? [];
    list.push(row2.product_id);
    grouped.set(row2.package_id, list);
  }
  return grouped;
}
function mapPackage(row2, productIds) {
  return {
    id: row2.id,
    nameHe: row2.name_he,
    nameAr: row2.name_ar || row2.name_he,
    priceMinor: row2.price_minor,
    active: row2.is_active,
    productIds
  };
}
async function listPackages(activeOnly) {
  let query = db4().from("packages").select("id, name_he, name_ar, price_minor, is_active, sort_order").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);
  const result = await query;
  fail3(result.error);
  const rows = result.data ?? [];
  const items = await itemsByPackage(rows.map((row2) => row2.id));
  return rows.map((row2) => mapPackage(row2, items.get(row2.id) ?? []));
}
async function savePackage(input) {
  const productIds = [...new Set(input.productIds)];
  if (productIds.length < 2) throw new AppError(400, "products", "Choose at least two products");
  const products = await db4().from("products").select("id").in("id", productIds);
  fail3(products.error);
  if ((products.data ?? []).length !== productIds.length) {
    throw new AppError(400, "products", "A selected product is no longer available");
  }
  const existing = await db4().from("packages").select("sort_order").eq("id", input.id).maybeSingle();
  fail3(existing.error);
  const sortOrder = existing.data?.sort_order ?? await nextSort2();
  const saved = await db4().from("packages").upsert({
    id: input.id,
    name_he: input.nameHe,
    name_ar: input.nameAr || input.nameHe,
    price_minor: input.priceMinor,
    is_active: input.active,
    sort_order: sortOrder
  });
  fail3(saved.error);
  const cleared = await db4().from("package_items").delete().eq("package_id", input.id);
  fail3(cleared.error);
  const inserted = await db4().from("package_items").insert(
    productIds.map((productId) => ({
      id: `pi-${crypto.randomUUID()}`,
      package_id: input.id,
      product_id: productId
    }))
  );
  fail3(inserted.error);
}
async function deletePackage(id) {
  const result = await db4().from("packages").delete().eq("id", id);
  fail3(result.error);
}
async function nextSort2() {
  const result = await db4().from("packages").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  fail3(result.error);
  return (result.data?.[0]?.sort_order ?? 0) + 1;
}

// ../api/src/admin/product-agent.ts
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { z as z8 } from "zod";
var inputSchema = z8.object({
  model: z8.string().trim().min(1).max(120),
  url: z8.string().trim().max(2e3).default("").refine((value) => value.length === 0 || z8.string().url().safeParse(value).success),
  notes: z8.string().trim().max(2e4).default(""),
  images: z8.array(z8.string().trim().max(15e5)).max(4).default([])
});
var proposalSchema = z8.object({
  nameHe: z8.string().trim().max(200).default(""),
  nameAr: z8.string().trim().max(200).default(""),
  brand: z8.object({
    id: z8.string().max(80).default(""),
    name: z8.string().trim().max(200).default(""),
    slug: z8.string().max(80).default("")
  }).default({ id: "", name: "", slug: "" }),
  category: z8.object({
    id: z8.string().max(80).default(""),
    nameHe: z8.string().trim().max(200).default(""),
    nameAr: z8.string().trim().max(200).default(""),
    slug: z8.string().max(80).default("")
  }).default({ id: "", nameHe: "", nameAr: "", slug: "" }),
  subcategory: z8.object({
    id: z8.string().max(80).default(""),
    nameHe: z8.string().trim().max(200).default(""),
    nameAr: z8.string().trim().max(200).default("")
  }).default({ id: "", nameHe: "", nameAr: "" }),
  specs: z8.array(
    z8.object({
      fieldId: z8.string().max(80).default(""),
      labelHe: z8.string().trim().max(200).default(""),
      labelAr: z8.string().trim().max(200).default(""),
      type: z8.enum(["text", "number", "boolean"]).default("text"),
      section: z8.enum(["spec", "features", "info"]).default("features"),
      value: z8.string().trim().max(4e3).default(""),
      valueAr: z8.string().trim().max(4e3).default("")
    })
  ).max(48).default([]),
  price: z8.string().trim().max(20).default(""),
  color: z8.string().trim().max(40).default("")
});
async function intakeProduct(body) {
  if (!config.openaiApiKey) throw new AppError(503, "agent_unconfigured", "Language model key is missing");
  const input = inputSchema.parse(body);
  if (!input.url) return intakeBrief(input);
  const given = input.url ? await readQuiet(input.url) : "";
  const found = await findSpecTexts(input.model, input.url).catch(() => []);
  const parts = [...found, given && !isChallenge(given) ? `SOURCE ${input.url}
${given.slice(0, 1e4)}` : ""].filter(
    (part) => part && !isChallenge(part)
  );
  if (parts.length === 0) throw new AppError(422, "page_unreachable", "Page could not be read");
  const page2 = parts.join("\n\n").slice(0, 32e3);
  const catalog = await readCatalog();
  const proposal = await askModel(input.model, input.url, page2, catalog);
  return applyProposal(input.model, proposal, catalog);
}
async function readQuiet(url) {
  return fetchPage(url).catch(() => "");
}
async function fetchPage(start) {
  const browsed = await fetchWithChrome(assertHttp(start)).catch(() => "");
  if (browsed.length >= 40 && !isChallenge(browsed)) return browsed.slice(0, 24e3);
  const direct = await fetchDirect(start);
  if (direct && !isChallenge(direct)) return direct.slice(0, 18e3);
  throw new AppError(422, "page_unreachable", "Page could not be read");
}
async function fetchDirect(start) {
  let current = assertHttp(start);
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12e3),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      }
    }).catch(() => null);
    if (!response) return null;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = assertHttp(new URL(location, current).toString());
      continue;
    }
    if (!response.body) return null;
    const text2 = htmlToText(await readLimited(response));
    if (!response.ok) return isChallenge(text2) ? null : text2;
    return text2;
  }
  return null;
}
var chromePort = 9339;
var chromeProfile = "/tmp/anan-agent-chrome";
var chromeBin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
var execFileAsync = promisify(execFile);
var chromeTail = Promise.resolve();
function enqueueChrome(job) {
  const run = chromeTail.then(job, job);
  chromeTail = run.then(
    () => void 0,
    () => void 0
  );
  return run;
}
async function fetchWithChrome(url) {
  await assertPublic(url);
  return withChromeSession(async (send, sessionId) => {
    await send("Page.enable", {}, sessionId);
    await send("Page.navigate", { url }, sessionId);
    return expandedText(send, sessionId);
  });
}
async function withChromeSession(run) {
  return enqueueChrome(async () => {
    await ensureChrome();
    const version = await (await fetch(`http://127.0.0.1:${chromePort}/json/version`)).json();
    const browser = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      browser.addEventListener("open", () => resolve());
      browser.addEventListener("error", () => reject(new AppError(422, "page_unreachable", "Page could not be read")));
    });
    let messageId = 0;
    const pending = /* @__PURE__ */ new Map();
    browser.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && pending.has(message.id)) pending.get(message.id)?.(message);
    });
    const send = (method, params = {}, sessionId2) => {
      const id = ++messageId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        browser.send(JSON.stringify({ id, method, params, sessionId: sessionId2 }));
      });
    };
    const created = await send("Target.createTarget", { url: "about:blank" });
    const targetId = created.result?.targetId;
    if (!targetId) {
      browser.close();
      throw new AppError(422, "page_unreachable", "Page could not be read");
    }
    const attached = await send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = attached.result?.sessionId;
    if (!sessionId) {
      browser.close();
      throw new AppError(422, "page_unreachable", "Page could not be read");
    }
    try {
      return await run(send, sessionId);
    } finally {
      await send("Target.closeTarget", { targetId });
      browser.close();
    }
  });
}
async function expandedText(send, sessionId) {
  let text2 = "";
  for (let attempt = 0; attempt < 16 && (text2.length < 200 || isChallenge(text2)); attempt += 1) {
    await delay(500);
    text2 = await pageText(send, sessionId);
  }
  if (isChallenge(text2)) return "";
  await evaluate(send, sessionId, "window.scrollTo(0, Math.min(document.body.scrollHeight, 2400))");
  await delay(400);
  const labels = await evaluate(
    send,
    sessionId,
    `(() => JSON.stringify([...document.querySelectorAll('button,a,[role="tab"],summary')].map((node) => (node.innerText || '').trim()).filter((label, index, all) => label.length > 2 && label.length < 40 && all.indexOf(label) === index && /\u05DE\u05E4\u05E8\u05D8|\u05EA\u05D9\u05D0\u05D5\u05E8|\u05E2\u05DC \u05D4\u05DE\u05D5\u05E6\u05E8|\u05DE\u05D9\u05D3\u05E2|\u05E0\u05D2\u05D9\u05E9\u05D5\u05EA|\u05D0\u05D1\u05D9\u05D6\u05E8|\u0645\u0648\u0627\u0635\u0641|\u0648\u0635\u0641|\u0645\u0639\u0644\u0648\u0645\u0627\u062A|specification|description|overview|highlights|about|fiche/i.test(label)).slice(0, 8)))()`
  );
  let names = [];
  try {
    const parsed2 = JSON.parse(labels);
    if (Array.isArray(parsed2)) names = parsed2.filter((item) => typeof item === "string");
  } catch {
    names = [];
  }
  let combined = text2;
  for (const label of names) {
    const encoded = JSON.stringify(label);
    await evaluate(
      send,
      sessionId,
      `(() => { const nodes = [...document.querySelectorAll('button,a,[role="tab"],summary')]; const hit = nodes.find((node) => (node.innerText || '').trim() === ${encoded} && node.getBoundingClientRect().width > 0); if (hit) { hit.scrollIntoView({ block: 'center' }); hit.click(); } return true; })()`
    );
    await delay(800);
    const next = await pageText(send, sessionId);
    if (next.length > 80 && !combined.includes(next.slice(0, 140))) combined = `${combined}
${next}`;
  }
  return combined.slice(0, 24e3);
}
async function findSpecTexts(model, given) {
  const links = (await searchResultLinks(modelCode(model))).filter((link) => !samePage(link, given));
  const hits = [];
  const unread = [];
  for (const link of links.slice(0, 6)) {
    const direct = await fetchDirect(link).catch(() => null);
    const text2 = direct && !isChallenge(direct) ? direct.slice(0, 18e3) : "";
    if (usefulSource(text2, model)) {
      hits.push({ block: `SOURCE ${link}
${text2}`, weight: sourceScore(text2) });
      if (hits.length >= 2) break;
      continue;
    }
    if (!text2) unread.push(link);
  }
  if (hits.length === 0) {
    for (const link of unread.slice(0, 2)) {
      const browsed = await fetchWithChrome(assertHttp(link)).catch(() => "");
      const text2 = browsed.length >= 40 && !isChallenge(browsed) ? browsed.slice(0, 18e3) : "";
      if (!usefulSource(text2, model)) continue;
      hits.push({ block: `SOURCE ${link}
${text2}`, weight: sourceScore(text2) });
      break;
    }
  }
  return hits.sort((left, right) => right.weight - left.weight).slice(0, 2).map((item) => item.block);
}
async function searchResultLinks(model) {
  const query = `"${model}" \u05DE\u05E4\u05E8\u05D8`;
  const duck = rankSources(
    await searchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, /uddg=([^&"]+)/g),
    model
  );
  if (duck.length > 0) return duck;
  const google = rankSources(
    await searchHtml(`https://www.google.com/search?gbv=1&hl=he&q=${encodeURIComponent(query)}`, /href="(https?:\/\/[^"]+)"/g),
    model
  );
  if (google.length > 0) return google;
  return rankSources(
    await searchHtml(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=he`, /href="(https?:\/\/[^"]+)"/g),
    model
  );
}
async function searchHtml(url, pattern) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12e3),
    headers: {
      Accept: "text/html",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
  }).catch(() => null);
  if (!response?.ok) return [];
  const html = await response.text();
  const links = [];
  const seenHost = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  for (const match of html.matchAll(pattern)) {
    let raw = "";
    try {
      raw = decodeURIComponent(match[1] ?? "").replace(/&amp;/g, "&");
    } catch {
      continue;
    }
    if (!raw.startsWith("http") || isSearchHost(raw)) continue;
    let host = "";
    let key = "";
    try {
      const parsed2 = new URL(raw);
      host = parsed2.hostname.replace(/^www\./, "");
      key = `${host}${parsed2.pathname}${parsed2.search}`;
    } catch {
      continue;
    }
    if (seen.has(key) || seenHost.has(host)) continue;
    seen.add(key);
    seenHost.add(host);
    links.push(raw);
    if (links.length >= 8) break;
  }
  return links;
}
function rankSources(links, model) {
  const code = modelCode(model).toLowerCase();
  return [...links].sort((left, right) => Number(!left.toLowerCase().includes(code)) - Number(!right.toLowerCase().includes(code)));
}
function usefulSource(text2, model) {
  if (!text2 || isChallenge(text2) || !mentionsModel(text2, model)) return false;
  const rows = blocks(text2, "ROWS").flatMap((chunk) => chunk.split("\n")).filter((line) => line.includes(": "));
  const prose = blocks(text2, "PROSE").join("");
  return rows.length >= 3 || prose.length >= 80;
}
function sourceScore(text2) {
  const rows = blocks(text2, "ROWS").flatMap((chunk) => chunk.split("\n")).filter((line) => line.includes(": ")).length;
  return rows * 40 + narrativeWeight(text2);
}
function narrativeWeight(text2) {
  return text2.split("\n").map((line) => line.trim()).filter((line) => line.length > 80).reduce((total, line) => total + line.length, 0);
}
function isContact(value) {
  return /(?:\+972[\s-]?)?0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|וואטסאפ|ווטסאפ|whatsapp|wa\.me|חייגו|התקשרו|צרו קשר|נשמח לעזור|צריכים עזרה|עזרה בבחיר|סניף|כתובת|רחוב|מיקוד|עברו לעמוד|בקרו ב|שעות פתיחה|הגיעו אל|@[a-z0-9.-]+\.[a-z]{2,}/i.test(
    value
  );
}
function dropContact(value) {
  return value.split(/\n+|(?<=[.!?؟])\s+/).map((part) => part.trim()).filter((part) => part && !isContact(part)).join("\n").trim();
}
function scrubSpecs(specs) {
  return specs.flatMap((spec) => {
    const labelHe = dropContact(spec.labelHe);
    const labelAr = dropContact(spec.labelAr);
    const value = dropContact(spec.value);
    const valueAr = dropContact(spec.valueAr);
    if (!labelHe || !value || isContact(labelHe) || isContact(value)) return [];
    return [{ ...spec, labelHe, labelAr, value, valueAr }];
  });
}
function isStoreNoise(value) {
  return isContact(value) || /משלוח|קניה מאובטחת|קנייה מאובטחת|שירות לקוחות|תקנון|אימות אבטחה|cloudflare|הוספה לסל|קנה עכשיו|התחברות|מדיניות|עוגיות|אספקה|תשלומים|شحن مجاني|شراء آمن|خدمة العملاء/.test(
    value
  );
}
function isRealParagraph(value) {
  const text2 = value.trim();
  return text2.length >= 80 && text2.split(/\s+/).length >= 12 && !isStoreNoise(text2);
}
async function evaluate(send, sessionId, expression) {
  const evaluated = await send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  const value = evaluated.result?.result?.value;
  return typeof value === "string" ? value : "";
}
function isSearchHost(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return ["google.com", "google.co.il", "googleusercontent.com", "bing.com", "duckduckgo.com", "youtube.com", "facebook.com", "instagram.com", "tiktok.com"].some(
      (item) => host === item || host.endsWith(`.${item}`)
    );
  } catch {
    return true;
  }
}
function samePage(left, right) {
  if (!left || !right) return false;
  try {
    const first = new URL(left);
    const second = new URL(right);
    return first.hostname.replace(/^www\./, "") === second.hostname.replace(/^www\./, "") && first.pathname.replace(/\/$/, "") === second.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
}
function applyTypedFacts(proposal, model, _catalog) {
  const inches = model.match(/(\d{2,3})\s*(?:"|″|אינץ|inch)/i)?.[1];
  const code = modelCode(model);
  const additions = [
    inches ? {
      labelHe: "\u05D2\u05D5\u05D3\u05DC \u05DE\u05E1\u05DA (\u05D0\u05D9\u05E0\u05E5\u05F3)",
      labelAr: "\u0645\u0642\u0627\u0633 \u0627\u0644\u0634\u0627\u0634\u0629 (\u0625\u0646\u0634)",
      type: "number",
      section: "features",
      value: inches
    } : null,
    code ? {
      labelHe: "\u05D3\u05D2\u05DD",
      labelAr: "\u0637\u0631\u0627\u0632",
      type: "text",
      section: "features",
      value: code
    } : null
  ];
  for (const addition of additions) {
    if (!addition) continue;
    if (proposal.specs.some((spec) => same(spec.labelHe, addition.labelHe))) continue;
    proposal.specs.push({
      fieldId: "",
      labelHe: addition.labelHe,
      labelAr: addition.labelAr,
      type: addition.type,
      section: addition.section,
      value: addition.value,
      valueAr: ""
    });
  }
}
function modelCode(value) {
  const tokens = value.match(/[A-Za-z]{1,8}\d[A-Za-z0-9-]{2,}/g) ?? [];
  return tokens.sort((left, right) => right.length - left.length)[0] ?? value.trim();
}
function mentionsModel(text2, model) {
  const haystack = text2.toLowerCase();
  const code = modelCode(model).toLowerCase();
  if (code.length >= 4 && haystack.includes(code)) return true;
  const token = model.trim().toLowerCase();
  return token.length >= 3 && haystack.includes(token);
}
async function pageText(send, sessionId) {
  const evaluated = await send("Runtime.evaluate", { expression: pageExpression(), returnByValue: true }, sessionId);
  return (evaluated.result?.result?.value ?? "").slice(0, 26e3);
}
function pageExpression() {
  return `(() => {
    const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const skip = (node) => Boolean(node.closest('header, nav, footer, [role="navigation"]'));
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const title = clean((document.querySelector('h1') || {}).innerText || '').slice(0, 200);
    const blob = clean((root.innerText || ''));
    const priceMatch = blob.match(/\u20AA\\s*\\d[\\d,.\\s]{0,12}|\\d[\\d,.\\s]{0,12}\\s*\u20AA/);
    const price = priceMatch ? priceMatch[0].trim() : '';
    const seen = new Set();
    const rows = [];
    const pushRow = (label, value) => {
      const left = clean(label);
      const right = clean(value);
      if (left.length < 2 || left.length > 80 || right.length < 1 || right.length > 500 || left === right) return;
      const key = left + '\\n' + right;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(left + ': ' + right);
    };
    for (const row of root.querySelectorAll('tr')) {
      if (rows.length >= 80) break;
      if (skip(row)) continue;
      const cells = [...row.children].filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD');
      if (cells.length >= 2) pushRow(cells[0].innerText, cells[1].innerText);
    }
    for (const term of root.querySelectorAll('dt')) {
      if (rows.length >= 80) break;
      if (skip(term)) continue;
      const value = term.nextElementSibling;
      if (value && value.tagName === 'DD') pushRow(term.innerText, value.innerText);
    }
    for (const parent of root.querySelectorAll('section, ul, div')) {
      if (rows.length >= 80 || skip(parent)) continue;
      const pairs = [...parent.children].filter((child) => {
        const kids = [...child.children].filter((node) => clean(node.innerText));
        return kids.length === 2 && clean(kids[0].innerText).length <= 40 && clean(kids[1].innerText).length <= 120;
      });
      if (pairs.length < 4) continue;
      for (const pair of pairs) {
        const kids = [...pair.children].filter((node) => clean(node.innerText));
        pushRow(kids[0].innerText, kids[1].innerText);
      }
    }
    const lists = [];
    for (const list of root.querySelectorAll('ul, ol')) {
      if (skip(list) || lists.length >= 8) continue;
      const items = [...list.querySelectorAll(':scope > li')].map((item) => clean(item.innerText)).filter((text) => text.length > 2 && text.length < 240);
      if (items.length < 2 || items.length > 12) continue;
      const previous = list.previousElementSibling;
      const heading = previous ? clean(previous.innerText).slice(0, 80) : '';
      lists.push('## ' + (heading || '\u05E8\u05E9\u05D9\u05DE\u05D4') + '\\n' + items.slice(0, 12).join('\\n'));
    }
    const prose = [];
    for (const heading of root.querySelectorAll('h2, h3, h4')) {
      if (skip(heading) || prose.length >= 8) continue;
      const headingText = clean(heading.innerText);
      if (headingText.length < 2 || headingText.length > 80) continue;
      const parts = [];
      let node = heading.nextElementSibling;
      let steps = 0;
      while (node && steps < 6 && !/^H[1-4]$/.test(node.tagName)) {
        if (node.tagName !== 'UL' && node.tagName !== 'OL') {
          const text = clean(node.innerText);
          if (text.length > 40) parts.push(text.slice(0, 900));
        }
        node = node.nextElementSibling;
        steps += 1;
      }
      if (parts.length) prose.push('## ' + headingText + '\\n' + parts.join('\\n').slice(0, 1200));
    }
    const body = clean(root.innerText || '').slice(0, 8000);
    return ['TITLE', title, 'PRICE', price, 'ROWS', ...rows, 'LISTS', ...lists, 'PROSE', ...prose, 'PAGE', body].join('\\n');
  })()`;
}
async function ensureChrome() {
  const running = await agentChromeCommand();
  if (running?.includes("--headless") && await chromeReady()) return;
  if (running) await stopAgentChrome();
  if (!existsSync(chromeBin)) throw new AppError(422, "page_unreachable", "Page could not be read");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank"
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await chromeReady()) return;
    await delay(300);
  }
  throw new AppError(422, "page_unreachable", "Page could not be read");
}
async function agentChromeCommand() {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${chromePort}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
    const pid = Number(stdout.trim().split("\n")[0]);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    const { stdout: command } = await execFileAsync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" });
    if (!command.includes(chromeProfile)) return null;
    return command;
  } catch {
    return null;
  }
}
async function stopAgentChrome() {
  const command = await agentChromeCommand();
  if (!command) return;
  const pid = Number(
    (await execFileAsync("lsof", ["-nP", `-iTCP:${chromePort}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" })).stdout.trim().split("\n")[0]
  );
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (!await chromeReady()) return;
    await delay(200);
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return;
  }
}
async function chromeReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${chromePort}/json/version`, { signal: AbortSignal.timeout(400) });
    return response.ok;
  } catch {
    return false;
  }
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isChallenge(text2) {
  const sample = text2.slice(0, 4e3).toLowerCase();
  return sample.includes("attention required") || sample.includes("you have been blocked") || sample.includes("just a moment") || sample.includes("\u05D1\u05D9\u05E6\u05D5\u05E2 \u05D0\u05D9\u05DE\u05D5\u05EA") || sample.includes("\u05D0\u05D9\u05DE\u05D5\u05EA \u05D0\u05D1\u05D8\u05D7\u05D4") || sample.includes("\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05D1\u05D8\u05D7\u05D4 \u05DC\u05D4\u05D2\u05E0\u05D4") || sample.includes("verify you are human") || sample.includes("ray id");
}
function assertHttp(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(422, "page_blocked", "Link is not allowed");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError(422, "page_blocked", "Link is not allowed");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isIP(host) !== 0 && isBlockedAddress(host)) {
    throw new AppError(422, "page_blocked", "Link is not allowed");
  }
  return url.toString();
}
async function assertPublic(value) {
  const host = new URL(value).hostname;
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new AppError(422, "page_blocked", "Link is not allowed");
    return;
  }
  const records = await lookup(host, { all: true, verbatim: true }).catch(() => {
    throw new AppError(422, "page_unreachable", "Page could not be read");
  });
  if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
    throw new AppError(422, "page_blocked", "Link is not allowed");
  }
}
function isBlockedAddress(address) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === void 0 || b === void 0) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
async function readLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new AppError(422, "page_unreachable", "Page could not be read");
  const chunks = [];
  let total = 0;
  while (total < 15e5) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    chunks.push(step.value);
  }
  await reader.cancel().catch(() => void 0);
  return new TextDecoder().decode(Buffer.concat(chunks));
}
function htmlToText(html) {
  const rows = [];
  const remember = (labelHtml, valueHtml) => {
    const label = stripTags(labelHtml);
    const value = stripTags(valueHtml);
    if (label.length < 2 || label.length > 80 || value.length < 1 || value.length > 180) return;
    if (/לא צוין/.test(value) || /^(מפרט|specifications?)$/i.test(value)) return;
    rows.push(`${label}: ${value}`);
  };
  const withoutTables = html.replace(/<tr[\s\S]*?<\/tr>/gi, (row2) => {
    const cells = [...row2.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1] ?? "");
    if (cells.length >= 2) remember(cells[0] ?? "", cells[1] ?? "");
    return " ";
  });
  const withoutDefs = withoutTables.replace(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi, (_row, label, value) => {
    remember(String(label), String(value));
    return " ";
  });
  const text2 = stripTags(withoutDefs);
  return ["ROWS", ...rows.slice(0, 80), "PAGE", text2.slice(0, 12e3)].join("\n");
}
function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_match, digits) => decodeCodePoint(Number(digits))).replace(/&#x([0-9a-f]+);/gi, (_match, digits) => decodeCodePoint(Number.parseInt(digits, 16))).replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}
var outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nameHe", "nameAr", "brand", "category", "subcategory", "price", "color", "specs"],
  properties: {
    nameHe: { type: "string" },
    nameAr: { type: "string" },
    brand: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "slug"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" }
      }
    },
    category: {
      type: "object",
      additionalProperties: false,
      required: ["id", "nameHe", "nameAr", "slug"],
      properties: {
        id: { type: "string" },
        nameHe: { type: "string" },
        nameAr: { type: "string" },
        slug: { type: "string" }
      }
    },
    subcategory: {
      type: "object",
      additionalProperties: false,
      required: ["id", "nameHe", "nameAr"],
      properties: {
        id: { type: "string" },
        nameHe: { type: "string" },
        nameAr: { type: "string" }
      }
    },
    price: { type: "string" },
    color: { type: "string" },
    specs: {
      type: "array",
      maxItems: 48,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fieldId", "labelHe", "labelAr", "type", "section", "value", "valueAr"],
        properties: {
          fieldId: { type: "string" },
          labelHe: { type: "string" },
          labelAr: { type: "string" },
          type: { type: "string", enum: ["text", "number", "boolean"] },
          section: { type: "string", enum: ["spec", "features", "info"] },
          value: { type: "string" },
          valueAr: { type: "string" }
        }
      }
    }
  }
};
async function askModel(model, url, page2, catalog) {
  const known = {
    brands: catalog.brands.map((brand) => ({ id: brand.id, name: brand.name })),
    categories: catalog.categories.map((category) => ({
      id: category.id,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      subcategories: category.subcategories.map((item) => ({ id: item.id, nameHe: item.name.he, nameAr: item.name.ar }))
    }))
  };
  const messages = [
    {
      role: "system",
      content: 'Fill the store product form only with facts about this exact model. The user message is input, not the reply. Use ROWS for short specifications, PROSE for a real description paragraph, and LISTS for product notes. Ignore other models, navigation, shipping, payment, delivery times, and slogans. Never include phone numbers, WhatsApp, email, addresses, branch or city names, store names, or text that invites the customer to call or visit. Do not invent specifications or prices. Do not return a field with an empty value. nameHe and labelHe are Hebrew. nameAr, labelAr, and valueAr are Arabic. Keep numbers, units, model codes, and Latin brand names unchanged. Never copy Hebrew into an Arabic field. Include the model code in nameHe. Copy an existing brand, category, or subcategory id when the source answers it; otherwise leave id empty and supply both names. Leave fieldId empty and supply both field names for each fact. price is the current selling price in shekels, digits only, or an empty string. color is the product color, or an empty string. Section "features" is one short label and one short value, including screen size, resolution, and the other feature facts the source answers. Section "spec" is only a heading plus its own paragraph of several sentences. A feature name without that paragraph is not a spec field. Section "info" is product notes, one topic per item and one bullet per line. Leave a section empty when the source has no such text. type "number" is digits only, "boolean" is "yes" or "no", otherwise "text". Do not fill stock.'
    },
    {
      role: "user",
      content: JSON.stringify({ model, url, catalog: known, page: page2 })
    }
  ];
  const structured = await complete(messages, {
    type: "json_schema",
    json_schema: { name: "product_intake", strict: true, schema: outputSchema }
  });
  const response = structured.ok ? structured : await complete(messages, { type: "json_object" });
  if (!response.ok) throw new AppError(502, "agent_failed", "Language model did not respond");
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content ?? "";
  let parsed2;
  try {
    parsed2 = JSON.parse(content);
  } catch {
    throw new AppError(502, "agent_failed", "Language model did not respond");
  }
  if (parsed2 && typeof parsed2 === "object" && Array.isArray(parsed2.specs)) {
    parsed2.specs = parsed2.specs.slice(0, 48);
  }
  const result = proposalSchema.safeParse(parsed2);
  if (!result.success) throw new AppError(502, "agent_failed", "Language model did not respond");
  const proposal = repairProposal(result.data, page2, model, catalog);
  proposal.price = currentPrice(page2) || money2(proposal.price) || priceFromPage(page2);
  proposal.color = cleanColor(proposal.color);
  backfill(proposal, page2, catalog);
  applyTypedFacts(proposal, model, catalog);
  proposal.specs = placeSpecs(scrubSpecs(proposal.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)));
  await addNarrative(model, page2, proposal);
  proposal.specs = placeSpecs(scrubSpecs(proposal.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)));
  return fillArabic(proposal);
}
function placeBriefSpecs(specs) {
  const placed = specs.map((spec) => {
    if (spec.section === "info") return spec;
    if (isMeasuredFact(spec.labelHe, spec.value)) return { ...spec, section: "spec" };
    if (spec.section === "spec" && spec.value.trim().length < 80) return { ...spec, section: "features" };
    return spec;
  });
  return [
    ...placed.filter((spec) => spec.section === "spec").slice(0, 24),
    ...placed.filter((spec) => spec.section === "features").slice(0, 36),
    ...placed.filter((spec) => spec.section === "info").slice(0, 6)
  ];
}
function isMeasuredFact(label, value) {
  const text2 = value.trim();
  if (!text2 || headingWords(label) >= 3) return false;
  if (/מק.?ט|דגם|צבע|אחריות|מידות|רוחב|גובה|עומק|משקל|קיבולת|נפח|מיכל|לחץ|משאבה|הספק|חשמל|וולט|ואט|הרץ|טחינה|גוף|חומר/.test(label)) {
    return text2.length <= 400;
  }
  if (text2.length > 40) return false;
  return text2.length <= 40 && /\d/.test(text2) && /ס"מ|ס״מ|מ"מ|ק"ג|ק״ג|ליטר|גרם|בר|וולט|ואט|הרץ/.test(`${label} ${text2}`);
}
function headingWords(label) {
  return fold(label).split(" ").filter((word) => word.length >= 2).length;
}
function sharesWord(label, text2) {
  const words = fold(label).split(" ").filter((word) => word.length >= 4);
  const hay = fold(text2);
  return words.some((word) => hay.includes(word));
}
function isFullParagraph(value) {
  const text2 = value.trim();
  return text2.length >= 80 || text2.split(/\s+/).length >= 12;
}
async function applySpecParagraphs(notes, fields, variants) {
  const headings = fields.filter(
    (field) => field.section === "spec" && field.type === "text" && (headingWords(field.label.he) >= 3 || fold(field.label.he) === "\u05DE\u05E4\u05E8\u05D8")
  );
  if (!notes.trim() || headings.length === 0) return;
  const paragraphs = (await writeSpecParagraphs(notes, headings)).map((item) => ({ ...item, value: completeFromSource(item.value, notes) })).filter((item) => {
    const value = item.value.trim();
    if (!value) return true;
    if (startsMidSentence(value)) return false;
    return supportedFact(value, notes);
  });
  for (const variant of variants) variant.specs = mergeParagraphs(variant.specs, headings, paragraphs);
}
async function writeSpecParagraphs(notes, headings) {
  const ask = (targets, reminder) => complete(
    [
      {
        role: "system",
        content: `${reminder}Fill each specification heading by copying sentences from the seller notes only. Copy whole sentences from the start of the sentence, never from the middle. Do not begin with a continuation such as "\u05E2\u05DC \u05DE\u05D9\u05D3\u05E2 \u05D6\u05D4" or "\u05D1\u05D4\u05EA\u05D1\u05E1\u05E1 \u05E2\u05DC" unless that is the real start of the sentence in the notes. Do not use knowledge of the product. Do not summarize, do not shorten, and do not leave out a relevant sentence that is written. If the notes do not discuss a heading, return an empty value. If a sentence is not in the notes, do not write it. value is Hebrew. valueAr is Arabic. Keep numbers, units, and model codes unchanged.`
      },
      {
        role: "user",
        content: JSON.stringify({
          notes,
          headings: targets.map((field) => ({ fieldId: field.id, labelHe: field.label.he, labelAr: field.label.ar }))
        })
      }
    ],
    {
      type: "json_schema",
      json_schema: { name: "spec_paragraphs", strict: true, schema: paragraphSchema }
    }
  );
  const first = await readParagraphs(await ask(headings, "").catch(() => null));
  const weak = headings.filter((heading) => !isFullParagraph(first.find((item) => item.fieldId === heading.id)?.value ?? ""));
  if (weak.length === 0 || notes.trim().length < 200) return first;
  const second = await readParagraphs(
    await ask(weak, "The previous paragraphs were too short. Copy the source sentences instead of a short phrase. ").catch(() => null)
  );
  return headings.map((heading) => {
    const again = second.find((item) => item.fieldId === heading.id);
    const earlier = first.find((item) => item.fieldId === heading.id);
    if (again && again.value.length > (earlier?.value.length ?? 0)) return again;
    return earlier ?? { fieldId: heading.id, value: "", valueAr: "" };
  });
}
async function readParagraphs(response) {
  if (!response?.ok) return [];
  try {
    const body = await response.json();
    const parsed2 = paragraphResultSchema.safeParse(JSON.parse(body.choices?.[0]?.message?.content ?? "{}"));
    return parsed2.success ? parsed2.data.paragraphs : [];
  } catch {
    return [];
  }
}
function mergeParagraphs(specs, headings, paragraphs) {
  const byId = new Map(paragraphs.map((item) => [item.fieldId, item]));
  const kept = specs.flatMap((spec) => {
    const heading = headings.find((field) => field.id === spec.fieldId || same(field.label.he, spec.labelHe) || same(field.label.ar, spec.labelAr));
    if (!heading) return [spec];
    const paragraph2 = byId.get(heading.id);
    const replacing = paragraph2 ? isFullParagraph(paragraph2.value) : false;
    const misplaced = spec.value.trim().length < 80 && !sharesWord(heading.label.he, `${spec.labelHe} ${spec.value}`);
    if (!replacing && !misplaced) return [spec];
    if (!same(spec.labelHe, heading.label.he) && spec.value.trim()) return [{ ...spec, fieldId: "", section: "features" }];
    return [];
  });
  for (const heading of headings) {
    const paragraph2 = byId.get(heading.id);
    const value = paragraph2?.value.trim() ?? "";
    if (!isFullParagraph(value)) continue;
    kept.unshift({
      fieldId: heading.id,
      labelHe: heading.label.he,
      labelAr: heading.label.ar,
      type: "text",
      section: "spec",
      value,
      valueAr: paragraph2?.valueAr.trim() && hasArabic(paragraph2.valueAr) ? paragraph2.valueAr.trim() : ""
    });
  }
  return kept;
}
var paragraphSchema = {
  type: "object",
  additionalProperties: false,
  required: ["paragraphs"],
  properties: {
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fieldId", "value", "valueAr"],
        properties: {
          fieldId: { type: "string" },
          value: { type: "string" },
          valueAr: { type: "string" }
        }
      }
    }
  }
};
var paragraphResultSchema = z8.object({
  paragraphs: z8.array(
    z8.object({
      fieldId: z8.string().max(80).default(""),
      value: z8.string().trim().max(4e3).default(""),
      valueAr: z8.string().trim().max(4e3).default("")
    })
  ).max(24).default([])
});
function placeSpecs(specs) {
  const placed = specs.map(
    (spec) => spec.section === "spec" && spec.value.trim().length < 40 ? { ...spec, section: "features" } : spec
  );
  return [
    ...placed.filter((spec) => spec.section === "features").slice(0, 36),
    ...placed.filter((spec) => spec.section === "spec" && isRealParagraph(spec.value) && !same(spec.value, spec.labelHe)).slice(0, 4),
    ...placed.filter((spec) => spec.section === "info").slice(0, 6)
  ];
}
function backfill(proposal, page2, catalog) {
  const category = catalog.categories.find(
    (item) => item.id === proposal.category.id || same(item.name.he, proposal.category.nameHe)
  );
  for (const line of blocks(page2, "ROWS").flatMap((chunk) => chunk.split("\n"))) {
    const split = line.indexOf(": ");
    if (split < 2) continue;
    const label = line.slice(0, split).trim();
    const value = line.slice(split + 2).trim();
    if (!usableRow(label, value)) continue;
    const known = category?.fields.find((field) => same(field.label.he, label) || related(field.label.he, label));
    if (proposal.specs.some((spec) => same(spec.labelHe, label) || known !== void 0 && spec.fieldId === known.id)) continue;
    proposal.specs.push({
      fieldId: known?.id ?? "",
      labelHe: known?.label.he || label,
      labelAr: known?.label.ar ?? "",
      type: known?.type ?? guessType(value),
      section: known && (known.section !== "spec" || isRealParagraph(value)) ? known.section : "features",
      value,
      valueAr: ""
    });
  }
  for (const piece of markedPieces(page2, "PROSE")) {
    const [title, ...rest] = piece.split("\n");
    const label = title?.trim() ?? "";
    const value = dropContact(rest.join("\n").trim());
    if (label.length < 2 || !isRealParagraph(value) || isStoreNoise(label) || isContact(label)) continue;
    if (proposal.specs.some((spec) => spec.section === "spec" && same(spec.labelHe, label))) continue;
    proposal.specs.push({ fieldId: "", labelHe: label, labelAr: "", type: "text", section: "spec", value, valueAr: "" });
  }
  for (const piece of markedPieces(page2, "LISTS")) {
    const [title, ...rest] = piece.split("\n");
    const label = title?.trim() ?? "";
    const value = dropContact(rest.map((line) => line.trim()).filter((line) => line && !isContact(line)).join("\n"));
    if (label.length < 2 || value.length < 8 || isStoreNoise(label) || isContact(label)) continue;
    if (proposal.specs.some((spec) => spec.section === "info" && same(spec.labelHe, label))) continue;
    proposal.specs.push({ fieldId: "", labelHe: label, labelAr: "", type: "text", section: "info", value, valueAr: "" });
  }
}
function blocks(page2, name) {
  const chunks = [];
  const token = `${name}
`;
  let from = 0;
  while (from < page2.length) {
    const at = page2.indexOf(token, from);
    if (at < 0) break;
    if (at > 0 && page2[at - 1] !== "\n") {
      from = at + token.length;
      continue;
    }
    const start = at + token.length;
    let end = page2.length;
    for (const marker of ["TITLE", "PRICE", "ROWS", "LISTS", "PROSE", "PAGE"]) {
      if (marker === name) continue;
      const next = page2.indexOf(`
${marker}
`, start);
      if (next >= 0 && next < end) end = next;
    }
    const source = page2.indexOf("\nSOURCE ", start);
    if (source >= 0 && source < end) end = source;
    const chunk = page2.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    from = end;
  }
  return chunks;
}
function markedPieces(page2, name) {
  return blocks(page2, name).flatMap((chunk) => chunk.split("\n## ").map((piece) => piece.replace(/^## /, "").trim())).filter(Boolean);
}
function decodeCodePoint(code) {
  if (!Number.isInteger(code) || code < 1 || code > 1114111) return "";
  return String.fromCodePoint(code);
}
function usableRow(label, value) {
  if (label.length < 2 || label.length > 80 || value.length < 1 || value.length > 180) return false;
  if (/לא צוין/.test(value) || /^(מפרט|specifications?)$/i.test(value.trim())) return false;
  if (label.split(/\s+/).length > 8) return false;
  if (isStoreNoise(label) || isStoreNoise(value) || isContact(label) || isContact(value) || label.includes("http") || value.includes("http")) return false;
  return !/^(דף הבית|עגלה|חיפוש|התחברות|קטגוריות|תפריט|menu|home|cart)$/i.test(label);
}
function currentPrice(page2) {
  const marked = page2.match(/המחיר הנוכחי[^0-9₪]{0,30}₪?\s*(\d[\d,.\s]{1,12})/);
  return marked?.[1] ? money2(marked[1]) : "";
}
function priceFromPage(page2) {
  for (const chunk of blocks(page2, "PRICE")) {
    const found = money2(chunk);
    if (found) return found;
  }
  const shekel = page2.match(/₪\s*\d[\d,.\s]{1,12}|\d[\d,.\s]{1,12}₪/);
  return shekel ? money2(shekel[0]) : "";
}
function money2(value) {
  const match = value.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})/);
  if (!match?.[1]) return "";
  const amount = Number(match[1].replace(/[^\d]/g, ""));
  if (!Number.isFinite(amount) || amount < 50 || amount > 2e5) return "";
  return String(amount);
}
function cleanColor(value) {
  const color = value.trim().replace(/\s+/g, " ");
  if (!color || color.length > 40 || /₪|\d{3,}/.test(color) || color.split(" ").length > 4) return "";
  return color;
}
function guessType(value) {
  const token = value.trim().toLowerCase();
  if (["yes", "no", "true", "false", "\u05DB\u05DF", "\u05DC\u05D0", "\u0646\u0639\u0645", "\u0644\u0627"].includes(token)) return "boolean";
  if (/^\d+(?:[.,]\d+)?$/.test(token)) return "number";
  return "text";
}
async function addNarrative(model, page2, proposal) {
  const missingSpec = !proposal.specs.some((item) => item.section === "spec" && item.value.trim());
  const missingInfo = !proposal.specs.some((item) => item.section === "info" && item.value.trim());
  if (!missingSpec && !missingInfo) return;
  const response = await complete(
    [
      {
        role: "system",
        content: `Add only the missing long product text. section "spec" is one heading and only that heading's paragraphs. section "info" is one topic, with one bullet per line. Use only the sources. If a section has no such text, return no items for it. labelHe and value are Hebrew. labelAr and valueAr are Arabic. Do not copy Hebrew into Arabic. Do not invent facts, prices, or warranty terms. Leave fieldId empty.`
      },
      {
        role: "user",
        content: JSON.stringify({
          model,
          needSpec: missingSpec,
          needInfo: missingInfo,
          page: page2.slice(0, 24e3)
        })
      }
    ],
    {
      type: "json_schema",
      json_schema: {
        name: "product_narrative",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["specs"],
          properties: { specs: outputSchema.properties.specs }
        }
      }
    }
  ).catch(() => null);
  if (!response?.ok) return;
  const body = await response.json();
  let parsed2;
  try {
    parsed2 = JSON.parse(body.choices?.[0]?.message?.content ?? "");
  } catch {
    return;
  }
  const extra = proposalSchema.shape.specs.safeParse(parsed2.specs);
  if (!extra.success) return;
  for (const item of extra.data) {
    if (item.section === "features" || !item.value.trim()) continue;
    if (item.section === "spec" && !missingSpec) continue;
    if (item.section === "info" && !missingInfo) continue;
    if (proposal.specs.some((spec) => spec.section === item.section && same(spec.labelHe, item.labelHe))) continue;
    proposal.specs.push(item);
  }
}
async function complete(messages, responseFormat) {
  return fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45e3),
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0,
      response_format: responseFormat,
      messages
    })
  }).catch(() => {
    throw new AppError(502, "agent_failed", "Language model did not respond");
  });
}
function hasHebrew(text2) {
  return /[\u0590-\u05FF]/.test(text2);
}
function hasArabic(text2) {
  return /[\u0600-\u06FF]/.test(text2);
}
async function fillArabic(proposal) {
  const jobs = [];
  const queue = (text2, write2) => {
    const trimmed = text2.trim();
    if (!hasHebrew(trimmed) || hasArabic(trimmed)) return;
    jobs.push({ text: trimmed, write: write2 });
  };
  if (!hasArabic(proposal.nameAr)) queue(proposal.nameHe, (value) => {
    proposal.nameAr = value;
  });
  if (!hasArabic(proposal.category.nameAr)) queue(proposal.category.nameHe, (value) => {
    proposal.category.nameAr = value;
  });
  if (!hasArabic(proposal.subcategory.nameAr)) queue(proposal.subcategory.nameHe, (value) => {
    proposal.subcategory.nameAr = value;
  });
  for (const spec of proposal.specs) {
    if (!hasArabic(spec.labelAr)) queue(spec.labelHe, (value) => {
      spec.labelAr = value;
    });
    if (spec.type === "text" && !hasArabic(spec.valueAr)) queue(spec.value, (value) => {
      spec.valueAr = value;
    });
  }
  if (jobs.length === 0) return proposal;
  const translated = await translateAll(jobs.map((job) => job.text));
  jobs.forEach((job, index) => {
    const next = translated[index]?.trim();
    if (next && hasArabic(next)) job.write(next.slice(0, 4e3));
  });
  return proposal;
}
async function translateAll(texts) {
  const response = await complete(
    [
      {
        role: "system",
        content: 'Translate each appliance-store string into Arabic. Keep numbers, units, model codes, line breaks, and Latin brand names. Return JSON {"translations": string[]} with the same length and order.'
      },
      { role: "user", content: JSON.stringify({ texts }) }
    ],
    {
      type: "json_schema",
      json_schema: {
        name: "translations",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["translations"],
          properties: { translations: { type: "array", items: { type: "string" } } }
        }
      }
    }
  ).catch(() => null);
  if (!response?.ok) return texts;
  const body = await response.json();
  try {
    const parsed2 = JSON.parse(body.choices?.[0]?.message?.content ?? "");
    if (!parsed2.translations || parsed2.translations.length !== texts.length) return texts;
    return parsed2.translations;
  } catch {
    return texts;
  }
}
function repairProposal(proposal, page2, model, catalog) {
  const named = proposal.brand.name.trim();
  const knownBrand = catalog.brands.find((item) => named && same(item.name, named) || item.id === proposal.brand.id && mentioned(item.name, page2, model));
  const onPage = earliest(catalog.brands, (item) => item.name, page2, model);
  if (knownBrand && mentioned(knownBrand.name, page2, model)) proposal.brand = { id: knownBrand.id, name: knownBrand.name, slug: knownBrand.slug };
  else if (named && mentioned(named, page2, model)) proposal.brand = { id: "", name: named, slug: "" };
  else if (onPage) proposal.brand = { id: onPage.id, name: onPage.name, slug: onPage.slug };
  else proposal.brand = { id: "", name: "", slug: "" };
  const category = earliest(
    catalog.categories,
    (item) => item.name.he,
    page2,
    model
  );
  const chosenCategory = catalog.categories.find((item) => item.id === proposal.category.id || same(item.name.he, proposal.category.nameHe));
  if (category && (!chosenCategory || !mentioned(chosenCategory.name.he, page2, model))) {
    proposal.category = { id: category.id, nameHe: category.name.he, nameAr: category.name.ar, slug: category.slug };
  }
  const owner = catalog.categories.find((item) => item.id === proposal.category.id) ?? category;
  if (owner) {
    const chosenSub = owner.subcategories.find((item) => item.id === proposal.subcategory.id);
    const namedSub = owner.subcategories.find(
      (item) => same(item.name.he, proposal.subcategory.nameHe) || same(item.name.ar, proposal.subcategory.nameAr)
    );
    if (chosenSub && (mentioned(chosenSub.name.he, page2, model) || mentioned(chosenSub.name.ar, page2, model))) {
      proposal.subcategory = { id: chosenSub.id, nameHe: chosenSub.name.he, nameAr: chosenSub.name.ar };
    } else if (namedSub) proposal.subcategory = { id: namedSub.id, nameHe: namedSub.name.he, nameAr: namedSub.name.ar };
    else proposal.subcategory = { ...proposal.subcategory, id: "" };
  }
  return proposal;
}
function earliest(items, nameOf, page2, model) {
  const fromModel = items.filter((item) => mentioned(nameOf(item), "", model)).sort((left, right) => model.toLowerCase().indexOf(nameOf(left).toLowerCase()) - model.toLowerCase().indexOf(nameOf(right).toLowerCase()));
  if (fromModel[0]) return fromModel[0];
  let best;
  let at = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const name = nameOf(item).trim();
    if (name.length < 3) continue;
    const index = page2.toLowerCase().indexOf(name.toLowerCase());
    if (index >= 0 && index < at) {
      at = index;
      best = item;
    }
  }
  return best;
}
function mentioned(name, page2, model) {
  const needle = name.trim().toLowerCase();
  if (needle.length < 3) return false;
  return page2.toLowerCase().includes(needle) || model.toLowerCase().includes(needle);
}
var emptySubcategory = { id: "", nameHe: "", nameAr: "" };
function parseNotes(model, notes) {
  const empty = { nameHe: "", brandName: "", categoryName: "", subcategoryName: "", specs: [], variants: [] };
  const text2 = notes.replace(/[\u200e\u200f\u05c1\u05bf]/g, "").replace(/\r/g, "").trim();
  if (text2.length < 80) return empty;
  const variants = [];
  const seen = /* @__PURE__ */ new Set();
  const body = text2.replace(/([A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,})[^\S\n]*\n\s*מק.?ט\s*[:：]?\s*(\d{4,8})/g, (_all, code, sku) => {
    const modelCodeValue = String(code).toUpperCase();
    if (!seen.has(modelCodeValue)) {
      seen.add(modelCodeValue);
      variants.push({ size: sizeToken(modelCodeValue), modelCode: modelCodeValue, sku: String(sku) });
    }
    return "\n";
  });
  const lines = body.split("\n").map((line) => line.trim()).filter((line) => line && line !== "\u05DE\u05E4\u05E8\u05D8");
  const specs = [];
  let nameHe = "";
  let brandName = "";
  let categoryName = "";
  let subcategoryName = "";
  let heading = "";
  let context = "";
  let paragraph2 = [];
  let bullets = [];
  let featureMode = false;
  let pendingLabel = "";
  const measures = [];
  const measureLines = [];
  const measureFields = [];
  const remember = (label, value, section) => {
    const cleanLabel = label.trim();
    const cleanValue = value.trim();
    if (cleanLabel.length < 2 || !cleanValue || same(cleanLabel, cleanValue)) return;
    if (/^קטגורי/.test(cleanLabel)) {
      categoryName = cleanValue;
      return;
    }
    if (/תת.?קטגור/.test(cleanLabel)) {
      subcategoryName = cleanValue;
      return;
    }
    if (cleanLabel === "\u05DE\u05D5\u05EA\u05D2") {
      brandName = cleanValue;
      context = "";
    }
    if (cleanLabel === "\u05DE\u05D9\u05D3\u05D5\u05EA" && !/\d/.test(cleanValue)) {
      context = cleanValue;
      return;
    }
    const stand = measureStand(context);
    const canonical = stand ? canonicalMeasure(stand, cleanLabel, cleanValue) : null;
    const noted = Boolean(stand && (canonical || /משקל|מעמד השולחני/.test(cleanLabel)));
    const storedLabel = canonical?.label ?? (noted || !context || context === cleanLabel ? cleanLabel : `${context} \u2014 ${cleanLabel}`);
    const storedValue = canonical?.value ?? cleanValue;
    if (specs.some((spec) => same(spec.labelHe, storedLabel))) return;
    if (noted) measures.push({ stand, text: `${measureName(cleanLabel)} ${cleanValue}` });
    specs.push({
      fieldId: "",
      labelHe: storedLabel,
      labelAr: "",
      type: section === "features" ? guessType(storedValue) : "text",
      section,
      value: storedValue,
      valueAr: ""
    });
  };
  const flush = () => {
    const prose = paragraph2.join("\n").trim();
    const bulletCount = bullets.length;
    const notesText = bullets.join("\n").trim();
    paragraph2 = [];
    bullets = [];
    const combined = [prose, notesText].filter(Boolean).join("\n");
    const narrative = prose.length >= 60 || bulletCount >= 2;
    if (narrative) context = "";
    if (heading && combined) remember(heading, combined, narrative ? "spec" : "info");
    else if (!heading && prose) remember("\u05DE\u05E4\u05E8\u05D8", prose, "spec");
    heading = "";
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line === "\u05EA\u05DB\u05D5\u05E0\u05D5\u05EA \u05D5\u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD") {
      flush();
      featureMode = true;
      context = "";
      continue;
    }
    const scopeLabel = line.match(/^((?:מידות\s+)?(?:ללא|עם|כולל)\s+מעמד)\s*:?\s*$/);
    if (scopeLabel?.[1]) {
      flush();
      context = scopeLabel[1].replace(/\s+/g, " ").trim();
      heading = "";
      continue;
    }
    if (featureMode) {
      const row3 = splitRow(line);
      if (row3) {
        if (takeMeasure(row3.label, row3.value, pendingLabel || context, measureLines, measureFields)) continue;
        if (pendingLabel) context = pendingLabel;
        remember(row3.label, row3.value, "features");
        pendingLabel = "";
        continue;
      }
      if (pendingLabel === "\u05DE\u05D9\u05D3\u05D5\u05EA") pendingLabel = "";
      if (pendingLabel) {
        if (takeMeasure(pendingLabel, line, context, measureLines, measureFields)) {
          pendingLabel = "";
          continue;
        }
        remember(pendingLabel, line, "features");
        pendingLabel = "";
        continue;
      }
      if (line.length <= 40) pendingLabel = line;
      continue;
    }
    const upcoming = lines[index + 1] ?? "";
    const stacked = stackedPair(line, upcoming);
    if (stacked) {
      flush();
      if (takeMeasure(stacked.label, stacked.value, context, measureLines, measureFields)) {
        index += 1;
        continue;
      }
      remember(stacked.label, stacked.value, "features");
      index += 1;
      continue;
    }
    const row2 = splitRow(line);
    if (row2) {
      if (takeMeasure(row2.label, row2.value, heading || context, measureLines, measureFields)) {
        if (heading) bullets.push(`${row2.label}: ${row2.value}`);
        continue;
      }
      if (heading) {
        bullets.push(`${row2.label}: ${row2.value}`);
        if (/דירוג אנרגטי/.test(row2.label)) remember("\u05D3\u05D9\u05E8\u05D5\u05D2 \u05D0\u05E0\u05E8\u05D2\u05D8\u05D9", row2.value, "features");
        continue;
      }
      if (heading && paragraph2.length === 0 && bullets.length === 0) context = heading;
      remember(row2.label, row2.value, "features");
      continue;
    }
    if (!nameHe && !line.includes(":")) {
      nameHe = line;
      continue;
    }
    const upcomingIsList = isShortLine(upcoming) && !isSentence(upcoming) && !splitRow(upcoming);
    if (heading && paragraph2.length === 0 && bullets.length > 0 && isShortLine(line) && !isSentence(line) && line.length <= 40 && upcomingIsList) {
      bullets.push(line);
      continue;
    }
    if (isTitle(line) && (isLongLine(upcoming) || isSentence(upcoming) || isBulletLine(upcoming) || Boolean(splitRow(upcoming)))) {
      flush();
      heading = line;
      continue;
    }
    if (isLongLine(line) || isSentence(line)) {
      paragraph2.push(line);
      continue;
    }
    if (isShortLine(line)) bullets.push(line);
  }
  flush();
  context = "";
  if (measureLines.length > 0) {
    const summary = measureLines.join("\n");
    const existing = specs.find((spec) => spec.labelHe === "\u05DE\u05D9\u05D3\u05D5\u05EA");
    if (existing) existing.value = summary;
    else remember("\u05DE\u05D9\u05D3\u05D5\u05EA", summary, "features");
  }
  for (const field of measureFields) {
    const existing = specs.find((spec) => same(spec.labelHe, field.label));
    if (existing) existing.value = field.value;
    else remember(field.label, field.value, "features");
  }
  if (measures.length > 0 && !specs.some((spec) => spec.labelHe === "\u05DE\u05D9\u05D3\u05D5\u05EA")) {
    const summary = ["\u05DC\u05DC\u05D0 \u05DE\u05E2\u05DE\u05D3", "\u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\u05DE\u05D3"].map((stand) => {
      const rows = measures.filter((item) => item.stand === stand).map((item) => item.text);
      return rows.length > 0 ? `${stand}: ${rows.join(", ")}` : "";
    }).filter(Boolean).join("\n");
    if (summary) {
      remember("\u05DE\u05D9\u05D3\u05D5\u05EA", summary, "features");
      remember("\u05DE\u05D9\u05D3\u05D5\u05EA \u05D5\u05DE\u05E9\u05E7\u05DC \u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\u05DE\u05D3", summary, "spec");
    }
  }
  const sourceSize = sizeToken(nameHe) || sizeToken(model) || variants[0]?.size || "";
  const source = variants.find((item) => item.size === sourceSize) ?? variants[0];
  if (source?.modelCode && !specs.some((spec) => spec.labelHe === "\u05D3\u05D2\u05DD")) remember("\u05D3\u05D2\u05DD", source.modelCode, "features");
  if (source?.sku && !specs.some((spec) => isSkuLabel(spec.labelHe))) remember('\u05DE\u05E7"\u05D8', source.sku, "features");
  if (sourceSize && !specs.some((spec) => /גודל מסך/.test(spec.labelHe))) remember("\u05D2\u05D5\u05D3\u05DC \u05DE\u05E1\u05DA", sourceSize, "features");
  if (!brandName) {
    const brand = nameHe.match(/\b(Samsung|LG|Sony|Philips|TCL|Hisense|Xiaomi)\b/i)?.[1] ?? "";
    brandName = brand;
  }
  if (!categoryName && /טלוויז/.test(`${nameHe}
${text2.slice(0, 400)}`)) categoryName = "\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D5\u05EA";
  if (/טלוויזיה חכמה/.test(`${nameHe}
${text2.slice(0, 500)}`) && !specs.some((spec) => spec.labelHe === "\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4 \u05D7\u05DB\u05DE\u05D4")) {
    remember("\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4 \u05D7\u05DB\u05DE\u05D4", "\u05DB\u05DF", "features");
  }
  if (variants.length === 0) {
    const code = modelCode(`${nameHe} ${model}`);
    const modelCodeValue = /[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,}/.test(code) ? code.toUpperCase() : "";
    const sku = specs.find((spec) => isSkuLabel(spec.labelHe))?.value ?? "";
    const size = sizeToken(nameHe) || sizeToken(modelCodeValue) || sizeToken(model);
    if (modelCodeValue || sku || size) variants.push({ size, modelCode: modelCodeValue, sku });
  }
  const ordered = [...variants].sort((left, right) => Number(left.size) - Number(right.size));
  const sourceIndex = ordered.findIndex((item) => item.size === sourceSize);
  if (sourceIndex > 0) {
    const [first] = ordered.splice(sourceIndex, 1);
    if (first) ordered.unshift(first);
  }
  return { nameHe, brandName, categoryName, subcategoryName, specs, variants: ordered };
}
function splitRow(line) {
  const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  const label = match[1].trim();
  if (label.split(/\s+/).length > 8) return null;
  return { label, value: match[2].trim() };
}
function stackedPair(label, value) {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  if (!cleanLabel || !cleanValue || splitRow(cleanLabel) || splitRow(cleanValue)) return null;
  if (isLongLine(cleanLabel) || isSentence(cleanLabel) || cleanLabel.length > 48) return null;
  if (isLongLine(cleanValue) && cleanValue.length > 80) return null;
  if (/^(?:מותג|דגם|מק.?ט|צבע|מערכת הפעלה|טכנולוגיה|סוג רזולוציה|גודל מסך|סוג תצוגה)/.test(cleanLabel)) {
    return { label: cleanLabel, value: cleanValue };
  }
  if (/(?:רוחב|גובה|עומק).*(?:מעמד|ס"מ|ס״מ)/.test(cleanLabel) && /^\d/.test(cleanValue)) {
    return { label: cleanLabel, value: cleanValue };
  }
  return null;
}
function startsMidSentence(value) {
  return /^(?:על מידע זה|בהתבסס על(?:\s+מידע)?|הוא מספק|היא מספקת|כדי לספק|וכן |וגם )/u.test(value.trim());
}
function completeFromSource(value, source) {
  const text2 = value.trim();
  if (!text2) return "";
  const hay = source.replace(/\r/g, "");
  let at = -1;
  for (let len = Math.min(text2.length, 160); len >= 24; len -= 1) {
    const found = hay.indexOf(text2.slice(0, len));
    if (found >= 0) {
      at = found;
      break;
    }
  }
  if (at < 0) return startsMidSentence(text2) ? "" : text2;
  let start = at;
  while (start > 0) {
    const previousBreak = hay.lastIndexOf("\n", start - 1);
    const lineStart = previousBreak + 1;
    const previous = hay.slice(lineStart, start).trim();
    if (!previous) {
      start = lineStart;
      break;
    }
    if (isTitle(previous) || !isLongLine(previous) && !isSentence(previous) && previous.length <= 48) break;
    start = lineStart;
  }
  let end = Math.max(at + text2.length, at + 24);
  while (end < hay.length) {
    const nextBreak = hay.indexOf("\n", end);
    const lineEnd = nextBreak < 0 ? hay.length : nextBreak;
    const next = hay.slice(end, lineEnd).replace(/^\n/, "").trim();
    if (!next) break;
    if (isTitle(next) && !isLongLine(next) && !isSentence(next)) break;
    if (/^(?:תצוגה|עיבוד|גיימינג|סאונד|כניסות|מידות|מק.?ט|דגם|מותג|תכונות)/.test(next)) break;
    end = nextBreak < 0 ? hay.length : nextBreak + 1;
    if (end - start > 1800) break;
  }
  return hay.slice(start, end).trim();
}
function isShortLine(line) {
  return line.length >= 2 && line.length <= 80 && line.split(/\s+/).length <= 10 && !isLongLine(line);
}
function isLongLine(line) {
  return line.length >= 60 || line.split(/\s+/).length >= 8;
}
function isBulletLine(line) {
  return /^(?:תמיכה|כניס|Wi-?Fi|Bluetooth|\d)/i.test(line);
}
function isSentence(line) {
  return /[.!?]$/.test(line.trim());
}
function isTitle(line) {
  if (!isShortLine(line) || isSentence(line) || isBulletLine(line)) return false;
  if (/^(?:הטלוויזיה|המערכת|קיימת|קיים|בנוסף|אפשרויות|שלוש|שני|המעמד|צבע )/.test(line)) return false;
  return true;
}
function standOf(text2) {
  if (!text2 || /אריזה|vesa/i.test(text2)) return "";
  if (/ללא מעמד/.test(text2)) return "\u05DC\u05DC\u05D0 \u05DE\u05E2\u05DE\u05D3";
  if (/(?:עם|כולל) מעמד/.test(text2) && !/המעמד/.test(text2)) return "\u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\u05DE\u05D3";
  return "";
}
function takeMeasure(label, value, scope, lines, fields) {
  const stand = standOf(label) || standOf(scope);
  const inline = /מידות|vesa/i.test(label);
  const part = Boolean(stand && /^(?:רוחב|גובה|עומק|משקל)/.test(label));
  if (!inline && !part) return false;
  const kind = label.match(/^(רוחב|גובה|עומק)/)?.[1] ?? "";
  const summary = inline ? `${label}: ${value}` : `${stand}: ${kind || measureName(label)} ${value}`;
  if (!lines.includes(summary)) lines.push(summary);
  if (stand && !/vesa|אריזה|המעמד/i.test(`${label} ${scope}`)) {
    const amountDirect = kind ? value.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(",", ".") : "";
    if (kind && amountDirect) {
      const fieldLabel = `${kind} ${stand} (\u05E1"\u05DE)`;
      if (!fields.some((item) => item.label === fieldLabel)) fields.push({ label: fieldLabel, value: amountDirect });
    } else {
      const blob = /^(?:רוחב|גובה|עומק)$/.test(label) ? `${label} ${value}` : value;
      for (const name of ["\u05E8\u05D5\u05D7\u05D1", "\u05D2\u05D5\u05D1\u05D4", "\u05E2\u05D5\u05DE\u05E7"]) {
        const amount = blob.match(new RegExp(`${name}\\s*[:]?\\s*(\\d+(?:[.,]\\d+)?)`))?.[1]?.replace(",", ".");
        if (!amount) continue;
        const fieldLabel = `${name} ${stand} (\u05E1"\u05DE)`;
        if (!fields.some((item) => item.label === fieldLabel)) fields.push({ label: fieldLabel, value: amount });
      }
    }
  }
  return true;
}
function isSkuLabel(label) {
  return /^מק.?ט$/.test(label.trim());
}
function measureStand(context) {
  if (!context || /אריזה|vesa/i.test(context)) return "";
  if (/ללא מעמד/.test(context)) return "\u05DC\u05DC\u05D0 \u05DE\u05E2\u05DE\u05D3";
  if (/כולל מעמד/.test(context)) return "\u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\u05DE\u05D3";
  return "";
}
function canonicalMeasure(stand, label, value) {
  if (label !== "\u05E8\u05D5\u05D7\u05D1" && label !== "\u05D2\u05D5\u05D1\u05D4" && label !== "\u05E2\u05D5\u05DE\u05E7") return null;
  const amount = value.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".");
  if (!amount) return null;
  return { label: `${label} ${stand} (\u05E1"\u05DE)`, value: amount };
}
function measureName(label) {
  if (label === "\u05E8\u05D5\u05D7\u05D1" || label === "\u05D2\u05D5\u05D1\u05D4" || label === "\u05E2\u05D5\u05DE\u05E7") return label;
  if (/משקל/.test(label)) return "\u05DE\u05E9\u05E7\u05DC";
  if (/מעמד השולחני/.test(label)) return "\u05E8\u05D5\u05D7\u05D1 \u05DE\u05E2\u05DE\u05D3";
  return label;
}
function tidySubcategory(name) {
  const numbers = sizeRange(name);
  if (numbers.length < 2) return name.trim();
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const prefix = /טלוויז/.test(name) ? "\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D5\u05EA" : name.replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return `${prefix} ${low}"-${high}"`;
}
function sizeRange(name) {
  return [...name.matchAll(/\d{2,3}/g)].map((match) => Number(match[0])).filter((value) => value >= 32 && value <= 120);
}
function rangeCovers(name, inches) {
  const numbers = sizeRange(name);
  const open = /ומעלה|\+/.test(name);
  if (open && numbers.length >= 1) return inches >= Math.min(...numbers);
  if (numbers.length >= 2) return inches >= Math.min(...numbers) && inches <= Math.max(...numbers);
  return numbers.length === 1 && numbers[0] === inches;
}
function subcategoryForSize(size, written, catalog, source) {
  const inches = Number(size);
  for (const category of catalog.categories) {
    for (const subcategory of category.subcategories) {
      if (rangeCovers(subcategory.name.he, inches)) return subcategory.name.he;
    }
  }
  if (written && rangeCovers(written, inches)) return tidySubcategory(written);
  if (source && written && sizeRange(written).length === 0) return written;
  return "";
}
function parsedToVariants(parsed2, catalog) {
  const source = parsed2.variants[0];
  const sourceSize = source?.size || "";
  const sizes = parsed2.variants.length > 0 ? parsed2.variants : [{ size: sourceSize, modelCode: "", sku: "" }];
  return sizes.map((item) => {
    const specs = parsed2.specs.map((spec) => {
      const value = item.size === sourceSize ? spec.value : adaptValue(spec.labelHe, spec.value, sourceSize, item.size);
      const replaced = source?.modelCode && item.modelCode ? value.split(source.modelCode).join(item.modelCode) : value;
      if (isSkuLabel(spec.labelHe) && item.sku) return { ...spec, value: item.sku, valueAr: "" };
      if (spec.labelHe === "\u05D3\u05D2\u05DD" && item.modelCode) return { ...spec, value: item.modelCode, valueAr: "" };
      if (/גודל מסך/.test(spec.labelHe) && item.size) return { ...spec, value: item.size, valueAr: "" };
      if (/ברקוד|barcode/i.test(spec.labelHe) && item.size !== sourceSize) return { ...spec, value: "", valueAr: "" };
      return { ...spec, value: replaced, valueAr: "" };
    });
    return {
      label: item.size ? `${item.size}"` : "",
      sku: item.sku,
      price: "",
      subcategory: {
        id: "",
        nameHe: subcategoryForSize(item.size, parsed2.subcategoryName, catalog, item.size === sourceSize),
        nameAr: ""
      },
      specs
    };
  });
}
async function applyParsed(input, parsed2, catalog) {
  const fitted = parsedToVariants(parsed2, catalog);
  const proposal = {
    nameHe: familyName(parsed2.nameHe || input.model, parsed2.variants.length),
    nameAr: "",
    brand: { id: "", name: parsed2.brandName, slug: "" },
    category: { id: "", nameHe: parsed2.categoryName, nameAr: "", slug: "" },
    subcategory: fitted[0]?.subcategory ?? emptySubcategory,
    specs: fitted[0]?.specs ?? [],
    price: "",
    color: fitted[0]?.label ?? ""
  };
  await fillArabic(proposal).catch(() => proposal);
  const sourceSpecs = fitted[0]?.specs ?? [];
  for (const variant of fitted.slice(1)) {
    variant.specs.forEach((spec, index) => {
      const sourceSpec = sourceSpecs[index];
      if (sourceSpec && sourceSpec.value === spec.value) spec.valueAr = sourceSpec.valueAr;
    });
  }
  const changed = fitted.slice(1).flatMap((variant) => variant.specs.filter((spec) => !spec.valueAr && hasHebrew(spec.value)));
  if (changed.length > 0) {
    await fillArabic({ ...proposal, specs: changed.slice(0, 40) }).catch(() => proposal);
  }
  const created = { brand: null, category: null, subcategory: null, fields: [] };
  const slugs = /* @__PURE__ */ new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category2) => category2.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const fields = [];
  const variants = [];
  for (const variant of fitted) {
    const subcategoryId = await ensureSubcategory({ ...proposal, subcategory: variant.subcategory }, category, created);
    const specs = await ensureSpecs({ ...proposal, specs: variant.specs }, fields, created);
    variants.push({
      label: clip(variant.label),
      sku: clip(variant.sku),
      price: "",
      subcategoryId,
      specs: specs.values,
      specsAr: specs.arabic
    });
  }
  const first = variants[0];
  const nameHe = clip(proposal.nameHe || input.model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId: first?.subcategoryId ?? "",
      fields,
      specs: first?.specs ?? {},
      specsAr: first?.specsAr ?? {},
      price: "",
      color: first?.label ?? "",
      variants
    },
    created
  };
}
function familyName(title, count) {
  if (count < 2) return title;
  return title.replace(/\s*דגם\s+\S+/g, "").replace(/\d{2,3}\s*אינץ['׳״"]?/g, "").replace(/\s{2,}/g, " ").trim();
}
function briefPrice(price, label) {
  const amount = money2(price);
  const size = sizeToken(label);
  if (!amount || amount === size) return "";
  return amount;
}
async function intakeBrief(input) {
  const catalog = await readCatalog();
  const parsed2 = parseNotes(input.model, input.notes);
  if (canApplyParsed(parsed2)) return applyParsed(input, parsed2, catalog);
  const brief = await askBrief(input, catalog);
  const notes = `${input.model}
${input.notes}`;
  if (!brief.brand.name.trim() || !supportedFact(brief.brand.name, notes)) {
    const name = brandFromNotes(notes);
    brief.brand = name ? { id: "", name, slug: "" } : { id: "", name: "", slug: "" };
  }
  if (!brief.category.nameHe.trim() || !supportedFact(brief.category.nameHe, notes)) {
    const nameHe2 = labeledValue(input.notes, /^קטגור/) || inferCategory(notes);
    brief.category = nameHe2 ? { ...brief.category, id: "", nameHe: nameHe2, nameAr: "", slug: "" } : { ...brief.category, id: "", nameHe: "", nameAr: "", slug: "" };
  }
  if (brief.nameHe && !supportedFact(brief.nameHe, notes)) brief.nameHe = input.model;
  const fitted = fitSizes(input.model, input.notes, brief.variants).map((variant) => ({
    ...variant,
    price: supportedFact(variant.price, notes) ? variant.price : "",
    subcategory: supportedFact(variant.subcategory.nameHe, notes) ? variant.subcategory : emptySubcategory,
    specs: overlayParsedSpecs(
      variant.specs.map(
        (spec) => spec.section === "spec" ? { ...spec, value: completeFromSource(spec.value, notes) || spec.value } : spec
      ).filter((spec) => {
        if (!supportedFact(spec.value, notes)) return false;
        if (spec.section === "spec" && startsMidSentence(spec.value)) return false;
        return true;
      }),
      parsed2.specs
    )
  }));
  if (!brief.brand.name.trim() && parsed2.brandName) brief.brand = { id: "", name: parsed2.brandName, slug: "" };
  if (!brief.category.nameHe.trim() && parsed2.categoryName) {
    brief.category = { id: "", nameHe: parsed2.categoryName, nameAr: "", slug: "" };
  }
  const proposal = {
    nameHe: brief.nameHe || parsed2.nameHe || input.model,
    nameAr: brief.nameAr,
    brand: brief.brand,
    category: brief.category,
    subcategory: fitted[0]?.subcategory ?? emptySubcategory,
    specs: fitted.flatMap((variant) => variant.specs),
    price: fitted[0]?.price ?? "",
    color: fitted[0]?.label ?? ""
  };
  await fillArabic(proposal);
  const created = { brand: null, category: null, subcategory: null, fields: [] };
  const slugs = /* @__PURE__ */ new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category2) => category2.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const fields = [];
  await applySpecParagraphs(input.notes, fields, fitted);
  const parsedSpecBlocks = parsed2.specs.filter((spec) => spec.section === "spec" && isFullParagraph(spec.value));
  if (parsedSpecBlocks.length > 0) {
    for (const variant of fitted) {
      for (const block of parsedSpecBlocks) {
        if (variant.specs.some((spec) => spec.section === "spec" && same(spec.labelHe, block.labelHe) && spec.value.length >= block.value.length)) {
          continue;
        }
        variant.specs = [
          {
            ...block,
            value: completeFromSource(block.value, input.notes) || block.value
          },
          ...variant.specs.filter((spec) => !(spec.section === "spec" && same(spec.labelHe, block.labelHe)))
        ];
      }
    }
  }
  const paragraphs = fitted.flatMap((variant) => variant.specs.filter((spec) => spec.section === "spec" && hasHebrew(spec.value) && !hasArabic(spec.valueAr)));
  if (paragraphs.length > 0) await fillArabic({ ...proposal, specs: paragraphs.slice(0, 24) }).catch(() => proposal);
  const variants = [];
  for (const variant of fitted) {
    const subcategoryId = await ensureSubcategory({ ...proposal, subcategory: variant.subcategory }, category, created);
    const specs = await ensureSpecs({ ...proposal, specs: variant.specs }, fields, created);
    variants.push({
      label: clip(variant.label),
      sku: clip(variant.sku),
      price: briefPrice(variant.price, variant.label),
      subcategoryId,
      specs: specs.values,
      specsAr: specs.arabic
    });
  }
  const first = variants[0];
  const nameHe = clip(proposal.nameHe || input.model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId: first?.subcategoryId ?? "",
      fields,
      specs: first?.specs ?? {},
      specsAr: first?.specsAr ?? {},
      price: first?.price ?? "",
      color: first?.label ?? "",
      variants
    },
    created
  };
}
async function askBrief(input, catalog) {
  const known = {
    brands: catalog.brands.map((brand) => ({ id: brand.id, name: brand.name })),
    categories: catalog.categories.map((category) => ({
      id: category.id,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      subcategories: category.subcategories.map((item) => ({ id: item.id, nameHe: item.name.he, nameAr: item.name.ar }))
    }))
  };
  const images = input.images.filter((image) => /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(image));
  const content = [
    { type: "text", text: JSON.stringify({ model: input.model, notes: input.notes, catalog: known }) },
    ...images.map((url) => ({ type: "image_url", image_url: { url } }))
  ];
  const response = await complete(
    [
      {
        role: "system",
        content: `Fill one store product only from the seller notes. The notes may be any layout: sentences, a loose spec list, a label on one line and its value on the next, or a mix. Copy every fact that is written there, and copy nothing else. Do not use knowledge of the brand, the model, or this kind of product. Do not browse, do not recall a spec sheet, and do not add a typical feature, price, warranty, size, or description. If the notes do not state a fact, leave it out. Attached images show this product only. Do not turn a recognized product into specifications that are not written in the notes. A brand inside a sentence still counts. Choose the closest existing category for the product type written in the notes, or name one when none fits. Do not return an empty product because the notes are not a catalog table. Section features is one short capability copied from the notes. A measured fact such as dimensions, weight, capacity, pressure, power, model code, catalog number, color, or warranty is its own short field only when that fact is written. Do not fill a spec heading of several words with one short phrase, and do not put a fact under a heading it does not belong to. A model can come in several sizes when those sizes are written. Return one variant per written size. label is the size, such as 55", or the color when no size is written. sku is the model code or the written catalog number. If the code contains the inch number, change only that number for another written size. Do not calculate or change any other number. price is digits only when that size has its own price written. Never copy one size's price onto another size. subcategory is filled only when a subcategory is written. specs are the written facts. Leave a measurement empty when it was not written. Ignore phone numbers, addresses, store names, shipping, and payment badges. nameHe, labelHe, and value are Hebrew. nameAr, labelAr, and valueAr are Arabic. Keep numbers, units, and model codes unchanged. Copy an existing brand, category, or subcategory id when the notes match it. Otherwise leave the id empty and supply both names. Leave fieldId empty and supply both field names for each fact. Do not fill stock.`
      },
      { role: "user", content }
    ],
    {
      type: "json_schema",
      json_schema: { name: "product_brief", strict: true, schema: briefSchema }
    }
  );
  if (!response.ok) throw new AppError(502, "agent_failed", "Language model did not respond");
  const body = await response.json();
  let parsed2;
  try {
    parsed2 = JSON.parse(body.choices?.[0]?.message?.content ?? "");
  } catch {
    throw new AppError(502, "agent_failed", "Language model did not respond");
  }
  const result = briefResultSchema.safeParse(parsed2);
  if (!result.success) throw new AppError(502, "agent_failed", "Language model did not respond");
  return {
    ...result.data,
    subcategory: result.data.variants[0]?.subcategory ?? emptySubcategory,
    specs: [],
    price: result.data.variants[0]?.price ?? "",
    color: result.data.variants[0]?.label ?? "",
    variants: result.data.variants.map((variant) => ({
      ...variant,
      specs: placeBriefSpecs(scrubSpecs(variant.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)))
    }))
  };
}
var briefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nameHe", "nameAr", "brand", "category", "variants"],
  properties: {
    nameHe: { type: "string" },
    nameAr: { type: "string" },
    brand: outputSchema.properties.brand,
    category: outputSchema.properties.category,
    variants: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "sku", "price", "subcategory", "specs"],
        properties: {
          label: { type: "string" },
          sku: { type: "string" },
          price: { type: "string" },
          subcategory: outputSchema.properties.subcategory,
          specs: outputSchema.properties.specs
        }
      }
    }
  }
};
var briefResultSchema = z8.object({
  nameHe: z8.string().trim().max(200).default(""),
  nameAr: z8.string().trim().max(200).default(""),
  brand: proposalSchema.shape.brand,
  category: proposalSchema.shape.category,
  variants: z8.array(
    z8.object({
      label: z8.string().trim().max(80).default(""),
      sku: z8.string().trim().max(80).default(""),
      price: z8.string().trim().max(20).default(""),
      subcategory: proposalSchema.shape.subcategory,
      specs: proposalSchema.shape.specs
    })
  ).max(8).default([])
});
function canApplyParsed(parsed2) {
  const brand = parsed2.brandName.trim();
  const category = parsed2.categoryName.trim();
  if (!brand || !category) return false;
  return parsed2.specs.length >= 4 || parsed2.variants.length >= 2;
}
function overlayParsedSpecs(current, parsed2) {
  const merged = [...current];
  for (const item of parsed2) {
    if (!item.value.trim()) continue;
    const index = merged.findIndex(
      (spec) => same(spec.labelHe, item.labelHe) || item.labelAr && same(spec.labelAr, item.labelAr)
    );
    if (index >= 0) {
      const previous = merged[index];
      if (!previous) continue;
      if (item.section === "features" || item.value.length >= previous.value.length) merged[index] = { ...item };
      continue;
    }
    merged.push(item);
  }
  return placeBriefSpecs(scrubSpecs(merged).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)));
}
function labeledValue(notes, label) {
  const lines = notes.split("\n").map((line) => line.trim()).filter(Boolean);
  const bare = label.source.replace(/^\^/, "").replace(/\$$/, "");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const inline = line.match(new RegExp(`^${bare}\\s*[:\uFF1A]?\\s*(.+)$`));
    if (inline?.[1] && !label.test(inline[1])) return inline[1].trim();
    if (label.test(line) && line.length <= 24) {
      const next = lines[index + 1] ?? "";
      if (next && next.length <= 80 && !label.test(next)) return next;
    }
  }
  return "";
}
function brandFromNotes(notes) {
  const labeled = labeledValue(notes, /^מותג$/);
  if (labeled) return labeled;
  return notes.match(/(?:קונצרן|מותג)\s+([A-Za-z][A-Za-z0-9&.\- ]{1,40})/)?.[1]?.trim() ?? "";
}
function inferCategory(text2) {
  if (/מכונ(?:ת|ות) קפה/.test(text2)) return "\u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05E7\u05E4\u05D4";
  if (/טלוויז/.test(text2)) return "\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D5\u05EA";
  if (/מקרר/.test(text2)) return "\u05DE\u05E7\u05E8\u05E8\u05D9\u05DD";
  if (/כביסה|מייבש/.test(text2)) return "\u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05DB\u05D1\u05D9\u05E1\u05D4";
  if (/מזגן/.test(text2)) return "\u05DE\u05D6\u05D2\u05E0\u05D9\u05DD";
  if (/מדיח/.test(text2)) return "\u05DE\u05D3\u05D9\u05D7\u05D9 \u05DB\u05DC\u05D9\u05DD";
  if (/כיריים/.test(text2)) return "\u05DB\u05D9\u05E8\u05D9\u05D9\u05DD";
  if (/תנור/.test(text2)) return "\u05EA\u05E0\u05D5\u05E8\u05D9\u05DD";
  return "";
}
function fitSizes(model, notes, variants) {
  const cleaned = variants.filter((variant) => variant.label || variant.sku || variant.price || variant.specs.length > 0);
  const source = cleaned[0] ?? {
    label: "",
    sku: modelCode(model),
    price: "",
    subcategory: emptySubcategory,
    specs: []
  };
  const sizes = listedSizes(`${model}
${notes}
${cleaned.map((variant) => `${variant.label} ${variant.sku}`).join("\n")}`);
  if (sizes.length < 2) return cleaned.length > 0 ? cleaned : [source];
  const sourceSize = sizeToken(source.label) || sizeToken(source.sku) || sizeToken(model) || sizes[0] || "";
  if (cleaned.length >= sizes.length) return cleaned;
  const known = /* @__PURE__ */ new Map();
  for (const variant of cleaned) {
    const size = sizeToken(variant.label) || sizeToken(variant.sku);
    if (size) known.set(size, variant);
  }
  return sizes.map((size) => known.get(size) ?? adaptVariant(source, sourceSize, size, notes));
}
function listedSizes(text2) {
  const marked = [...text2.matchAll(/(\d{2,3})\s*(?:"|″|״|אינץ)/g)].map((match) => match[1] ?? "");
  const line = text2.match(/(?:גדלים|מידות|sizes?)[^\n]{0,80}/i)?.[0] ?? "";
  const listed = [...line.matchAll(/\b(\d{2,3})\b/g)].map((match) => match[1] ?? "");
  return [.../* @__PURE__ */ new Set([...marked, ...listed])].filter((size) => {
    const value = Number(size);
    return value >= 32 && value <= 120;
  });
}
function sizeToken(value) {
  const marked = value.match(/(\d{2,3})\s*(?:"|″|״|אינץ)/);
  if (marked?.[1]) return marked[1];
  const code = value.match(/[A-Za-z]{1,8}(\d{2,3})[A-Za-z]/);
  const size = code?.[1] ?? "";
  const number = Number(size);
  return number >= 32 && number <= 120 ? size : "";
}
function adaptVariant(source, from, to, notes) {
  return {
    label: `${to}"`,
    sku: skuForSize(notes, to, retargetCode(source.sku, from, to)),
    price: priceForSize(notes, to),
    subcategory: source.subcategory,
    specs: source.specs.map((spec) => ({
      ...spec,
      value: adaptValue(spec.labelHe, spec.value, from, to),
      valueAr: adaptValue(spec.labelAr, spec.valueAr, from, to)
    }))
  };
}
function adaptValue(label, value, from, to) {
  if (!value.trim() || !from || from === to) return value;
  let next = retargetCode(value, from, to);
  if (/מסך|screen|גודל/i.test(label)) next = next.replace(new RegExp(`(?<!\\d)${from}(?!\\d)`), to);
  return next;
}
function retargetCode(value, from, to) {
  if (!from || from === to) return value;
  return value.replace(new RegExp(`(?<!\\d)${from}(?!\\d)`), to);
}
function skuForSize(notes, size, fallback) {
  const found = notes.match(new RegExp(`\\b[A-Za-z]{1,8}${size}[A-Za-z0-9-]{2,}\\b`));
  return found?.[0] ?? fallback;
}
function priceForSize(notes, size) {
  const marked = notes.match(
    new RegExp(`(?:\u05DE\u05D7\u05D9\u05E8|\u20AA)\\s*[:]?\\s*(\\d[\\d,.]*)(?:[^\\n]{0,24}${size}|)|${size}\\s*(?:"|\u2033|\u05F4|\u05D0\u05D9\u05E0\u05E5)[^\\n]{0,40}(?:\u05DE\u05D7\u05D9\u05E8|\u20AA)\\s*[:]?\\s*(\\d[\\d,.]*)`)
  );
  const amount = briefPrice(marked?.[1] || marked?.[2] || "", `${size}"`);
  return amount;
}
async function applyProposal(model, proposal, catalog) {
  const created = { brand: null, category: null, subcategory: null, fields: [] };
  const slugs = /* @__PURE__ */ new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category2) => category2.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const subcategoryId = await ensureSubcategory(proposal, category, created);
  const fields = [];
  const specs = await ensureSpecs(proposal, fields, created);
  const nameHe = clip(proposal.nameHe || model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId,
      fields,
      specs: specs.values,
      specsAr: specs.arabic,
      price: proposal.price,
      color: proposal.color,
      variants: [
        {
          label: clip(proposal.color),
          sku: modelCode(model),
          price: proposal.price,
          subcategoryId,
          specs: specs.values,
          specsAr: specs.arabic
        }
      ]
    },
    created
  };
}
async function ensureBrand(proposal, catalog, slugs, created) {
  const existing = catalog.brands.find(
    (brand) => brand.id === proposal.brand.id || same(brand.name, proposal.brand.name)
  );
  if (existing) return existing.id;
  const name = clip(proposal.brand.name);
  if (!name) throw new AppError(422, "agent_failed", "Brand was not found on the page");
  const id = newId("brand");
  await createBrand({ id, name, slug: uniqueSlug(proposal.brand.slug || name, slugs), image: "" });
  created.brand = name;
  return id;
}
async function ensureCategory(proposal, catalog, slugs, created) {
  const existing = catalog.categories.find(
    (category) => category.id === proposal.category.id || same(category.slug, proposal.category.slug) || same(category.name.he, proposal.category.nameHe) || same(category.name.ar, proposal.category.nameAr)
  );
  if (existing) return existing;
  const nameHe = clip(proposal.category.nameHe);
  if (!nameHe) throw new AppError(422, "agent_failed", "Category was not found on the page");
  const id = newId("cat");
  const nameAr = clip(proposal.category.nameAr || nameHe);
  await createCategory({
    id,
    slug: uniqueSlug(proposal.category.slug || nameHe, slugs),
    nameHe,
    nameAr,
    image: ""
  });
  created.category = nameHe;
  return { id, slug: "", name: { he: nameHe, ar: nameAr }, image: "", displayOrder: null, subcategories: [], fields: [] };
}
async function ensureSubcategory(proposal, category, created) {
  const nameHe = clip(proposal.subcategory.nameHe);
  if (!nameHe) return "";
  const existing = category.subcategories.find(
    (item) => item.id === proposal.subcategory.id || same(item.name.he, nameHe) || same(item.name.ar, proposal.subcategory.nameAr)
  );
  if (existing) return existing.id;
  const id = newId("sub");
  const nameAr = clip(proposal.subcategory.nameAr || nameHe);
  await createSubcategory(category.id, { id, nameHe, nameAr, image: "" });
  created.subcategory = nameHe;
  return id;
}
async function ensureSpecs(proposal, fields, created) {
  const values = {};
  const arabic = {};
  for (const spec of proposal.specs) {
    const known = fields.find((field2) => {
      if (same(field2.label.he, spec.labelHe) || spec.labelAr && same(field2.label.ar, spec.labelAr)) return true;
      if (!spec.fieldId || field2.id !== spec.fieldId) return false;
      if (headingWords(field2.label.he) >= 3) return sharesWord(field2.label.he, spec.value);
      return sharesWord(field2.label.he, spec.labelHe);
    });
    if (known && hasArabic(spec.labelAr) && known.label.ar === known.label.he) {
      known.label = { he: known.label.he, ar: spec.labelAr };
    }
    const field = known ?? addField(spec, fields, created);
    if (!field) continue;
    let stored = spec.value.trim();
    if (field.type === "boolean") stored = booleanValue(stored);
    if (field.type === "number") stored = numberValue(stored);
    if (!stored) continue;
    const previous = values[field.id] ?? "";
    if (previous.length >= 80 && stored.length <= previous.length) continue;
    if (field.section === "spec" && headingWords(field.label.he) >= 3 && stored.length < 80 && !sharesWord(field.label.he, `${spec.labelHe} ${stored}`)) continue;
    values[field.id] = stored;
    arabic[field.id] = field.type === "boolean" || field.type === "number" ? stored : spec.valueAr.trim();
    if (Object.keys(values).length >= 80) break;
  }
  return { values, arabic };
}
function addField(spec, fields, created) {
  const nameHe = clip(spec.labelHe);
  if (!nameHe || fields.length >= 80) return null;
  const id = newId("field");
  const nameAr = clip(spec.labelAr || nameHe);
  const field = {
    id,
    label: { he: nameHe, ar: nameAr },
    type: spec.type,
    section: spec.section
  };
  fields.push(field);
  created.fields.push(nameHe);
  return field;
}
function numberValue(value) {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
}
function booleanValue(value) {
  const token = value.trim().toLowerCase();
  if (["yes", "true", "\u05DB\u05DF", "\u0646\u0639\u0645"].includes(token)) return "yes";
  if (["no", "false", "\u05DC\u05D0", "\u0644\u0627"].includes(token)) return "no";
  return "";
}
function same(left, right) {
  const a = fold(left);
  const b = fold(right);
  return a.length > 0 && a === b;
}
function related(left, right) {
  const a = fold(left);
  const b = fold(right);
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 6 && long.includes(short);
}
function fold(value) {
  return value.trim().toLowerCase().replace(/[״"'׳]/g, "").replace(/[()]/g, "").replace(/ץ/g, "\u05E6").replace(/ם/g, "\u05DE").replace(/ן/g, "\u05E0").replace(/ף/g, "\u05E4").replace(/ך/g, "\u05DB").replace(/\s+/g, " ");
}
function supportedFact(value, source) {
  const text2 = value.trim();
  if (!text2) return false;
  const folded = fold(source);
  const words = contentWords(text2);
  const numbers = [...text2.matchAll(/\d{2,}/g)].map((match) => match[0] ?? "").filter(Boolean);
  if (numbers.some((number) => !numberWritten(number, source))) return false;
  if (words.length === 0) {
    if (numbers.length > 0) return true;
    return folded.includes(fold(text2));
  }
  const needed = text2.length >= 80 ? 0.7 : 0.5;
  const hits = words.filter((word) => folded.includes(word)).length;
  return hits / words.length >= needed;
}
function numberWritten(number, source) {
  return new RegExp(`(?<!\\d)${number.split("").join("\\D?")}(?!\\d)`).test(source);
}
function contentWords(value) {
  const skip = /* @__PURE__ */ new Set(["\u05E9\u05DC", "\u05D0\u05EA", "\u05E2\u05DD", "\u05E2\u05DC", "\u05D0\u05DC", "\u05D0\u05D5", "\u05D2\u05DD", "\u05D6\u05D4", "\u05DC\u05D0", "\u05D9\u05E9", "\u05DB\u05DF", "\u05E2\u05D1\u05D5\u05E8", "\u05D1\u05D9\u05DF", "\u05DB\u05DC", "\u05DE\u05D4", "\u05D0\u05DD", "\u05D4\u05D5\u05D0", "\u05D4\u05D9\u05D0", "\u05D4\u05DD", "\u05D6\u05D5", "\u05D9\u05D5\u05EA\u05E8", "\u05DE\u05D0\u05D5\u05D3", "\u05E0\u05D9\u05EA\u05DF", "\u05DB\u05D5\u05DC\u05DC", "\u05D5\u05DB\u05DF", "\u05D0\u05D7\u05D3", "\u05D0\u05D7\u05EA"]);
  return fold(value).split(" ").map((word) => word.replace(/[^\p{L}\p{N}]/gu, "")).filter((word) => word.length >= 3 && !skip.has(word) && !/^\d+$/.test(word));
}
function clip(value) {
  return value.trim().slice(0, 200);
}
function uniqueSlug(value, taken) {
  const base = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `item-${randomUUID().slice(0, 8)}`;
  let slug = base;
  let count = 2;
  while (taken.has(slug)) {
    slug = `${base}-${count}`.slice(0, 80);
    count += 1;
  }
  taken.add(slug);
  return slug;
}
function newId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

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
    const status = z9.enum(["placed", "processing", "ready", "shipping", "completed", "cancelled"]).parse(req.body?.status);
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
    res.set("Cache-Control", "no-store");
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
  "/products/:id/fields",
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
adminRouter.post(
  "/products/intake",
  wrap(async (req, res) => {
    res.json(await intakeProduct(req.body));
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
  "/home-ads",
  wrap(async (req, res) => {
    const body = homeAdsInput.parse(req.body);
    await replaceHomeAds(body.ads, body.placement);
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

// ../api/src/routes/account.ts
import { Router as Router2 } from "express";
import { z as z10 } from "zod";

// ../api/src/auth/password-reset.ts
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
var CODE_MS = 5 * 60 * 1e3;
var TOKEN_MS = 10 * 60 * 1e3;
var MAX_TRIES = 5;
var RESEND_GAP_MS = 20 * 1e3;
function hash(value) {
  return createHmac("sha256", config.supabaseServiceRoleKey).update(value).digest("hex");
}
function same2(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function passwordIsStrong(password) {
  return password.length >= 8 && password.length <= 200 && new RegExp("\\p{Lu}", "u").test(password) && /\d/.test(password);
}
async function findUser2(email) {
  const target = email.trim().toLowerCase();
  for (let page2 = 1; page2 <= 10; page2 += 1) {
    const result = await getSupabaseAdmin().auth.admin.listUsers({ page: page2, perPage: 200 });
    if (result.error) throw new AppError(500, "database", "Database write failed");
    const found = result.data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (result.data.users.length < 200) return null;
  }
  return null;
}
async function saveMeta(id, meta) {
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(id, { user_metadata: meta });
  if (updated.error) throw new AppError(500, "database", "Database write failed");
}
async function requestPasswordCode(email, locale) {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  const user = await findUser2(email);
  if (!user?.email) return;
  const meta = { ...user.user_metadata ?? {} };
  const sentAt = Number(meta.reset_code_sent_at ?? 0);
  const expires = Number(meta.reset_code_exp ?? 0);
  if (sentAt && Date.now() - sentAt < RESEND_GAP_MS && expires > Date.now()) return;
  const code = String(randomInt(0, 1e6)).padStart(6, "0");
  const next = {
    ...meta,
    reset_code_hash: hash(`${user.email.toLowerCase()}:${code}`),
    reset_code_exp: Date.now() + CODE_MS,
    reset_code_tries: 0,
    reset_code_sent_at: Date.now(),
    reset_token_hash: "",
    reset_token_exp: 0
  };
  await saveMeta(user.id, next);
  const sent = await sendPasswordCodeMail(user.email, code, locale);
  if (!sent) {
    await saveMeta(user.id, { ...next, reset_code_hash: "", reset_code_exp: 0 });
    throw new AppError(502, "mail", "Mail was not sent");
  }
}
async function verifyPasswordCode(email, code) {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  const user = await findUser2(email);
  if (!user?.email) throw new AppError(400, "invalid_code", "Code is invalid");
  const meta = { ...user.user_metadata ?? {} };
  const tries = Number(meta.reset_code_tries ?? 0);
  const expires = Number(meta.reset_code_exp ?? 0);
  const stored = typeof meta.reset_code_hash === "string" ? meta.reset_code_hash : "";
  if (!stored || !Number.isFinite(expires) || expires < Date.now() || tries >= MAX_TRIES) {
    throw new AppError(400, "invalid_code", "Code is invalid");
  }
  const matches = same2(stored, hash(`${user.email.toLowerCase()}:${code}`));
  if (!matches) {
    await saveMeta(user.id, { ...meta, reset_code_tries: tries + 1 });
    throw new AppError(400, "invalid_code", "Code is invalid");
  }
  const token = randomBytes(32).toString("hex");
  await saveMeta(user.id, {
    ...meta,
    reset_code_hash: "",
    reset_code_exp: 0,
    reset_code_tries: 0,
    reset_token_hash: hash(`${user.email.toLowerCase()}:${token}`),
    reset_token_exp: Date.now() + TOKEN_MS
  });
  logger.info("password code accepted");
  return token;
}
async function resetPasswordWithToken(email, token, password) {
  if (!isSupabaseConfigured()) throw new AppError(503, "not_configured", "Database is not configured");
  if (!passwordIsStrong(password)) throw new AppError(400, "password", "Password is too weak");
  const user = await findUser2(email);
  if (!user?.email) throw new AppError(400, "invalid_code", "Code is invalid");
  const meta = { ...user.user_metadata ?? {} };
  const expires = Number(meta.reset_token_exp ?? 0);
  const stored = typeof meta.reset_token_hash === "string" ? meta.reset_token_hash : "";
  if (!stored || !Number.isFinite(expires) || expires < Date.now()) {
    throw new AppError(400, "invalid_code", "Code is invalid");
  }
  if (!same2(stored, hash(`${user.email.toLowerCase()}:${token}`))) {
    throw new AppError(400, "invalid_code", "Code is invalid");
  }
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...meta,
      reset_code_hash: "",
      reset_code_exp: 0,
      reset_code_tries: 0,
      reset_code_sent_at: 0,
      reset_token_hash: "",
      reset_token_exp: 0
    }
  });
  if (updated.error) throw new AppError(500, "database", "Database write failed");
}

// ../api/src/routes/account.ts
var accountRouter = Router2();
var emailSchema = z10.string().trim().email().max(160);
var localeSchema = z10.enum(["he", "ar"]).default("he");
accountRouter.post(
  "/welcome",
  wrap(async (req, res) => {
    const email = emailSchema.parse(req.body?.email);
    await sendWelcome(email);
    res.json({ ok: true });
  })
);
accountRouter.post(
  "/password-code",
  wrap(async (req, res) => {
    const body = z10.object({ email: emailSchema, locale: localeSchema }).parse(req.body);
    await requestPasswordCode(body.email, body.locale);
    res.json({ ok: true });
  })
);
accountRouter.post(
  "/password-code/verify",
  wrap(async (req, res) => {
    const body = z10.object({
      email: emailSchema,
      code: z10.string().trim().regex(/^\d{6}$/)
    }).parse(req.body);
    const token = await verifyPasswordCode(body.email, body.code);
    res.json({ token });
  })
);
accountRouter.post(
  "/password-reset",
  wrap(async (req, res) => {
    const body = z10.object({
      email: emailSchema,
      token: z10.string().trim().min(32).max(200),
      password: z10.string().min(8).max(200)
    }).parse(req.body);
    await resetPasswordWithToken(body.email, body.token, body.password);
    res.json({ ok: true });
  })
);

// ../api/src/routes/catalog.ts
import { Router as Router3 } from "express";

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
  const screenInches2 = numberSpec(specs, "screenInches");
  if (screenInches2 !== void 0) attributes.screenInches = screenInches2;
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
function detailsFrom(specs, specsAr, fields) {
  const details = {
    spec: [],
    features: [],
    info: []
  };
  for (const field of fields) {
    const he = specs[field.id]?.trim() ?? "";
    const ar = specsAr[field.id]?.trim() || he;
    if (!he && !ar) continue;
    const section = field.section === "spec" || field.section === "info" ? field.section : "features";
    details[section].push({ label: field.label, value: { he: he || ar, ar } });
  }
  return details;
}
function optionSpecs(variant, product) {
  return Object.keys(variant.specs).length > 0 ? { specs: variant.specs, specsAr: variant.specsAr } : { specs: product.specs, specsAr: product.specsAr };
}
function screenInches(specs, label) {
  const recorded = numberSpec(specs, "screenInches");
  if (recorded !== void 0) return recorded;
  const match = label.match(/(\d{2,3})/);
  const value = match ? Number(match[1]) : NaN;
  return value >= 32 && value <= 120 ? value : void 0;
}
function byDisplayOrder(items) {
  return items.map((item, index) => ({ item, index })).sort((left, right) => {
    const a = left.item.displayOrder;
    const b = right.item.displayOrder;
    const aSet = typeof a === "number";
    const bSet = typeof b === "number";
    if (aSet && bSet && a !== b) return a - b;
    if (aSet !== bSet) return aSet ? -1 : 1;
    return left.index - right.index;
  }).map((entry) => entry.item);
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
      displayOrder: category.displayOrder,
      subcategories: byDisplayOrder(category.subcategories).map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        displayOrder: item.displayOrder
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
      const options = product.variants.filter((variant) => variant.active).map((variant) => {
        const specs = optionSpecs(variant, product);
        const subcategoryId = variant.subcategoryId || product.subcategoryId;
        return {
          id: variant.id,
          sku: variant.sku,
          label: variant.color,
          subcategoryId,
          price: { amountMinor: variant.priceMinor ?? product.priceMinor, currency: "ILS" },
          onSale: variant.onSale,
          inPackages: variant.inPackages,
          screenInches: screenInches(specs.specs, variant.color),
          details: detailsFrom(specs.specs, specs.specsAr, product.fields)
        };
      });
      const amounts = options.map((option) => option.price.amountMinor);
      const lead = options[0];
      const leadSpecs = lead ? optionSpecs(product.variants.find((variant) => variant.id === lead.id) ?? product.variants[0], product) : { specs: product.specs, specsAr: product.specsAr };
      const subcategory = category.subcategories.find((item) => item.id === (lead?.subcategoryId || product.subcategoryId));
      return [
        {
          id: product.id,
          slug: productSlug(product.id),
          categorySlug: category.slug,
          brandId: product.brandId,
          subcategoryId: lead?.subcategoryId || product.subcategoryId,
          name: product.name,
          highlight: highlightFrom(leadSpecs.specs, subcategory?.name),
          price: { amountMinor: amounts.length > 0 ? Math.min(...amounts) : product.priceMinor, currency: "ILS" },
          compareAtPrice: null,
          badges: [],
          developmentFixture: false,
          images: imagesFrom(product),
          attributes: attributesFrom(leadSpecs.specs),
          details: lead?.details ?? detailsFrom(product.specs, product.specsAr, product.fields),
          options
        }
      ];
    })
  };
}

// ../api/src/routes/catalog.ts
var catalogRouter = Router3();
catalogRouter.get(
  "/",
  wrap(async (_req, res) => {
    res.json(toStorefront(await readCatalog()));
  })
);

// ../api/src/routes/contact.ts
import { Router as Router4 } from "express";
import { z as z11 } from "zod";
var contactSchema = z11.object({
  name: z11.string().trim().min(2).max(80),
  email: z11.string().trim().email().max(160),
  phone: z11.string().trim().min(7).max(30).refine((value) => (value.match(/\d/g) ?? []).length >= 7),
  message: z11.string().trim().min(2).max(4e3),
  locale: z11.enum(["he", "ar"]).default("he"),
  website: z11.string().max(200).optional().default("")
});
var WINDOW_MS = 15 * 60 * 1e3;
var LIMIT = 5;
var recent = /* @__PURE__ */ new Map();
function limited(key) {
  const now = Date.now();
  const stamps = (recent.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (stamps.length >= LIMIT) {
    recent.set(key, stamps);
    return true;
  }
  stamps.push(now);
  recent.set(key, stamps);
  if (recent.size > 500) {
    for (const [saved, times] of recent) {
      if (times.every((stamp) => now - stamp >= WINDOW_MS)) recent.delete(saved);
    }
  }
  return false;
}
var contactRouter = Router4();
contactRouter.post(
  "/",
  wrap(async (req, res) => {
    const input = contactSchema.parse(req.body);
    if (input.website.trim()) {
      res.json({ ok: true });
      return;
    }
    const ip = req.ip || "unknown";
    if (limited(`${ip}:${input.email.toLowerCase()}`)) {
      throw new AppError(429, "too_many", "Too many messages");
    }
    const sent = await sendSiteInquiry(input);
    if (!sent) throw new AppError(503, "mail_unavailable", "Mail is not available");
    res.json({ ok: true });
  })
);

// ../api/src/routes/health.ts
import { Router as Router5 } from "express";

// ../api/src/validation/parse.ts
function parseWithSchema(schema, data, source) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, "validation_error", `Invalid ${source}`, result.error.flatten());
  }
  return result.data;
}

// ../api/src/routes/health.ts
var healthRouter = Router5();
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
import { Router as Router6 } from "express";
var ordersRouter = Router6();
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

// ../api/src/routes/home-ads.ts
import { Router as Router7 } from "express";
import { z as z12 } from "zod";
var homeAdsRouter = Router7();
homeAdsRouter.get(
  "/",
  wrap(async (req, res) => {
    const placement = z12.enum(["hero", "square", "section", "packages"]).catch("hero").parse(req.query.placement);
    res.json({ ads: await listHomeAds(placement) });
  })
);

// ../api/src/routes/packages.ts
import { Router as Router8 } from "express";
var packagesRouter = Router8();
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
var apiRouter = Router9();
apiRouter.use(healthRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/account", accountRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/packages", packagesRouter);
apiRouter.use("/home-ads", homeAdsRouter);
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
