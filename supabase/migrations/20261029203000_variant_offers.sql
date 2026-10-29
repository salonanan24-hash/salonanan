alter table public.product_variants
  add column if not exists sku text not null default '',
  add column if not exists price_minor integer,
  add column if not exists subcategory_id text references public.subcategories (id) on delete set null;

alter table public.product_variants
  drop constraint if exists product_variants_price_minor_check;

alter table public.product_variants
  add constraint product_variants_price_minor_check check (price_minor is null or price_minor >= 0);

create table if not exists public.variant_specs (
  variant_id text not null references public.product_variants (id) on delete cascade,
  field_id text not null references public.category_fields (id) on delete cascade,
  value text not null,
  value_ar text not null default '',
  primary key (variant_id, field_id)
);

alter table public.variant_specs enable row level security;

grant select, insert, update, delete on public.variant_specs to service_role;

revoke all on public.variant_specs from anon, authenticated;
