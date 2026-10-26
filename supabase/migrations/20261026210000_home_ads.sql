-- Homepage ad images. The browser reads them through the API.
-- Writes stay on the API after the admin email check.

create table if not exists public.home_ads (
  id text primary key,
  image_src text not null,
  target_kind text not null check (target_kind in ('category', 'subcategory', 'brand', 'product', 'package')),
  target_ref text not null,
  sort_order integer not null default 0
);

alter table public.home_ads enable row level security;

grant select, insert, update, delete on public.home_ads to service_role;
revoke all on public.home_ads from anon, authenticated;

insert into public.home_ads (id, image_src, target_kind, target_ref, sort_order)
values
  ('ad-refrigerators', '/catalog/vis-fridge.webp', 'category', 'refrigerators', 0),
  ('ad-laundry', '/catalog/vis-washer.webp', 'category', 'washing-machines', 1),
  ('ad-screens', '/catalog/vis-tv.webp', 'category', 'televisions', 2)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
