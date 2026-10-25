# ANAN data model

Phase 1 does not create these tables. This document is the intended model for later migrations. Money is stored as integer minor units (agorot) in Israeli shekels. Prices, discounts, and stock that reach an order are calculated on the API, never taken from the browser.

UI copy for Hebrew and Arabic lives in the web app dictionaries. Catalog text that must be edited by staff lives in the database with `he` and `ar` columns.

## Access

- The browser may use the Supabase anon key for Auth only.
- The service-role key stays on the API. It bypasses Row Level Security, so the API must authorize the caller before it writes.
- Customers can read and update their own profile and read their own orders.
- Public visitors can read active categories, brands, and products.
- Admin writes go through the API after the server confirms an active `admin_users` row. The admin screen in the browser is not proof of access.
- `audit_logs` are insert-only from the API.

## categories

- `id` uuid primary key
- `parent_id` uuid null, self-reference for subcategories
- `slug` text unique
- `name_he`, `name_ar` text
- `description_he`, `description_ar` text
- `sort_order` integer
- `is_active` boolean
- `seo_title_he`, `seo_title_ar`, `seo_description_he`, `seo_description_ar` text
- `created_at`, `updated_at` timestamptz

## brands

- `id` uuid primary key
- `slug` text unique
- `name` text
- `logo_path` text null, object key in Supabase Storage
- `is_active` boolean
- `created_at`, `updated_at`

## products

- `id` uuid primary key
- `brand_id` uuid references brands
- `category_id` uuid references categories
- `slug` text unique
- `name_he`, `name_ar` text
- `description_he`, `description_ar` text
- `status` text: `draft`, `active`, or `archived`
- SEO columns matching categories
- `created_at`, `updated_at`

Sellable price and stock belong to variants, not to a free-typed product row.

## product_variants

- `id` uuid primary key
- `product_id` uuid references products
- `sku` text unique
- `name_he`, `name_ar` text
- `price_minor` integer, the current shelf price used by the API
- `compare_at_minor` integer null
- `is_active` boolean

## product_images

- `id` uuid primary key
- `product_id` uuid references products
- `variant_id` uuid null references product_variants
- `storage_path` text
- `alt_he`, `alt_ar` text
- `sort_order` integer

## product_attributes

Technical specifications.

- `id` uuid primary key
- `product_id` uuid references products
- `name_he`, `name_ar` text
- `value_he`, `value_ar` text
- `sort_order` integer

## inventory

- `id` uuid primary key
- `variant_id` uuid unique references product_variants
- `warehouse_code` text
- `on_hand` integer, check `on_hand >= 0`
- `reserved` integer, check `reserved >= 0` and `reserved <= on_hand`

Reservations happen inside an API transaction when an order is placed. The browser never sends a stock quantity that the API trusts.

## customers

- `id` uuid primary key, same value as `auth.users.id`
- `full_name` text
- `phone` text
- `email` text
- `preferred_locale` text, `he` or `ar`
- `created_at`, `updated_at`

## orders

- `id` uuid primary key
- `customer_id` uuid null references customers
- `number` text unique
- `status` text
- `currency` text, `ILS`
- `subtotal_minor`, `discount_minor`, `delivery_minor`, `total_minor` integers
- `locale` text
- `placed_at` timestamptz

## order_items

Snapshots, so later catalog edits do not rewrite history.

- `id` uuid primary key
- `order_id` uuid references orders
- `variant_id` uuid null references product_variants
- `product_name_he`, `product_name_ar` text
- `sku` text
- `unit_price_minor` integer
- `quantity` integer
- `line_total_minor` integer

## payments

Provider references only. No card number, CVV, expiry, or raw card payload.

- `id` uuid primary key
- `order_id` uuid references orders
- `provider` text
- `provider_reference` text
- `status` text
- `amount_minor` integer
- `created_at`, `updated_at`

## shipments

- `id` uuid primary key
- `order_id` uuid references orders
- `method` text
- `price_minor` integer
- `status` text
- `tracking_number` text null
- `address` jsonb
- `created_at`, `updated_at`

## coupons

- `id` uuid primary key
- `code` text unique
- `discount_type` text, `percent` or `fixed`
- `value` integer
- `min_subtotal_minor` integer
- `starts_at`, `ends_at` timestamptz
- `is_active` boolean

The API validates the code, the cart, and the date, then writes `discount_minor` on the order. A matching code in the browser does not change the price.

## admin_users

- `user_id` uuid primary key references `auth.users.id`
- `role` text
- `is_active` boolean
- `created_at`

## audit_logs

- `id` uuid primary key
- `actor_id` uuid null
- `action` text
- `entity` text
- `entity_id` uuid null
- `metadata` jsonb
- `created_at` timestamptz

## Homepage banners

A later `banners` table can store placement, image path, localized title, link, and schedule. Phase 1 banners are coded in the homepage.

## What is intentionally absent

No migration creates orders, payments, or customer profiles yet. The admin catalog tables are created in `supabase/migrations/20261022183000_admin_catalog.sql`. The storefront reads that catalog through `GET /api/catalog`.
