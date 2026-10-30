alter table public.product_variants
  add column if not exists on_sale boolean not null default false;

alter table public.product_variants
  add column if not exists in_packages boolean not null default false;

notify pgrst, 'reload schema';
