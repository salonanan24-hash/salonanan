alter table public.home_ads
  add column if not exists placement text not null default 'hero';

alter table public.home_ads drop constraint if exists home_ads_placement_check;

alter table public.home_ads
  add constraint home_ads_placement_check check (placement in ('hero', 'square'));

notify pgrst, 'reload schema';
