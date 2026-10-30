alter table public.home_ads
  add column if not exists section text,
  add column if not exists layout text;

alter table public.home_ads drop constraint if exists home_ads_placement_check;
alter table public.home_ads
  add constraint home_ads_placement_check check (placement in ('hero', 'square', 'section'));

alter table public.home_ads drop constraint if exists home_ads_layout_check;
alter table public.home_ads
  add constraint home_ads_layout_check check (layout is null or layout in ('above', 'beside'));

alter table public.home_ads drop constraint if exists home_ads_section_check;
alter table public.home_ads
  add constraint home_ads_section_check
  check (section is null or section in ('featured', 'fridges', 'laundry', 'entertainment', 'tech', 'kitchen'));

create unique index if not exists home_ads_section_key on public.home_ads (section) where section is not null;

notify pgrst, 'reload schema';
