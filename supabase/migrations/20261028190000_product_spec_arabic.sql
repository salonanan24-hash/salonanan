alter table public.product_specs
  add column if not exists value_ar text not null default '';
