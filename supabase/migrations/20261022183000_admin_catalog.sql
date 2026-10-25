-- Admin catalog. The browser cannot read or write these tables.
-- The API uses the service role after it checks the admin account.

create table public.brands (
  id text primary key,
  slug text not null unique,
  name text not null,
  image_src text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  slug text not null unique,
  name_he text not null,
  name_ar text not null,
  image_src text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.subcategories (
  id text primary key,
  category_id text not null references public.categories (id) on delete cascade,
  name_he text not null,
  name_ar text not null,
  image_src text not null default '',
  sort_order integer not null default 0
);

create table public.category_fields (
  id text primary key,
  category_id text not null references public.categories (id) on delete cascade,
  label_he text not null,
  label_ar text not null,
  field_type text not null check (field_type in ('text', 'number', 'boolean')),
  section text not null default 'features' check (section in ('spec', 'features', 'info')),
  sort_order integer not null default 0
);

create table public.products (
  id text primary key,
  name_he text not null,
  name_ar text not null,
  price_minor integer not null check (price_minor >= 0),
  brand_id text not null references public.brands (id),
  category_id text not null references public.categories (id),
  subcategory_id text references public.subcategories (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_specs (
  product_id text not null references public.products (id) on delete cascade,
  field_id text not null references public.category_fields (id) on delete cascade,
  value text not null,
  primary key (product_id, field_id)
);

create table public.product_variants (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  color text not null default '',
  color_hex text not null default '#172033',
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.variant_images (
  id text primary key,
  variant_id text not null references public.product_variants (id) on delete cascade,
  src text not null,
  sort_order integer not null default 0
);

create table public.coupons (
  id text primary key,
  code text not null unique,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  ends_at text not null default '',
  sort_order integer not null default 0
);

create table public.store_settings (
  id boolean primary key default true check (id),
  phone text not null default '',
  accent text not null default 'burgundy'
);

create table public.shipping_zones (
  id text primary key,
  name text not null,
  price_minor integer not null check (price_minor >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.store_settings (id) values (true);

create index subcategories_category_id_idx on public.subcategories (category_id);
create index category_fields_category_id_idx on public.category_fields (category_id);
create index products_brand_id_idx on public.products (brand_id);
create index products_category_id_idx on public.products (category_id);
create index product_variants_product_id_idx on public.product_variants (product_id);
create index variant_images_variant_id_idx on public.variant_images (variant_id);

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.category_fields enable row level security;
alter table public.products enable row level security;
alter table public.product_specs enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_images enable row level security;
alter table public.coupons enable row level security;
alter table public.store_settings enable row level security;
alter table public.shipping_zones enable row level security;

grant select, insert, update, delete on
  public.brands,
  public.categories,
  public.subcategories,
  public.category_fields,
  public.products,
  public.product_specs,
  public.product_variants,
  public.variant_images,
  public.coupons,
  public.store_settings,
  public.shipping_zones
to service_role;

revoke all on
  public.brands,
  public.categories,
  public.subcategories,
  public.category_fields,
  public.products,
  public.product_specs,
  public.product_variants,
  public.variant_images,
  public.coupons,
  public.store_settings,
  public.shipping_zones
from anon, authenticated;

