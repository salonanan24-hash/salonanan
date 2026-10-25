create table if not exists public.orders (
  id text primary key,
  number text not null unique,
  customer_id uuid,
  customer_email text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'placed' check (status in ('placed', 'processing', 'completed', 'cancelled')),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  coupon_code text not null default '',
  note text not null default '',
  locale text not null default 'he',
  placed_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  product_id text,
  variant_id text,
  product_name_he text not null,
  product_name_ar text not null,
  image_src text not null default '',
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0),
  line_total_minor integer not null check (line_total_minor >= 0)
);

create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_email_idx on public.orders (lower(customer_email));
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select, insert, update, delete on public.orders, public.order_items to service_role;

revoke all on public.orders, public.order_items from anon, authenticated;

notify pgrst, 'reload schema';
