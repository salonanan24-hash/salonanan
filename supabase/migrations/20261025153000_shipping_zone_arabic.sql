alter table public.shipping_zones
  add column if not exists name_ar text not null default '';

notify pgrst, 'reload schema';
