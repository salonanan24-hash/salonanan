alter table public.orders
  add column if not exists delivery_method text not null default 'pickup',
  add column if not exists delivery_minor integer not null default 0 check (delivery_minor >= 0),
  add column if not exists shipping_zone text not null default '',
  add column if not exists shipping_address text not null default '';

notify pgrst, 'reload schema';
