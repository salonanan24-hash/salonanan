alter table public.coupons
  add column if not exists scope text not null default 'site';

alter table public.coupons
  drop constraint if exists coupons_scope_check;

alter table public.coupons
  add constraint coupons_scope_check
  check (scope in ('site', 'category', 'subcategory', 'products', 'brand'));

alter table public.coupons
  add column if not exists category_id text references public.categories (id) on delete set null;

alter table public.coupons
  add column if not exists subcategory_id text references public.subcategories (id) on delete set null;

alter table public.coupons
  add column if not exists brand_id text references public.brands (id) on delete set null;

create table if not exists public.coupon_products (
  coupon_id text not null references public.coupons (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  primary key (coupon_id, product_id)
);

alter table public.coupon_products enable row level security;

grant select, insert, update, delete on public.coupon_products to service_role;
revoke all on public.coupon_products from anon, authenticated;

notify pgrst, 'reload schema';
