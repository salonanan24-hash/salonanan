create table if not exists public.packages (
  id text primary key,
  name_he text not null,
  name_ar text not null default '',
  price_minor integer not null check (price_minor >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.package_items (
  id text primary key,
  package_id text not null references public.packages (id) on delete cascade,
  product_id text not null,
  unique (package_id, product_id)
);

create index if not exists package_items_package_id_idx on public.package_items (package_id);

alter table public.packages enable row level security;
alter table public.package_items enable row level security;

grant select, insert, update, delete on public.packages, public.package_items to service_role;
revoke all on public.packages, public.package_items from anon, authenticated;

notify pgrst, 'reload schema';
