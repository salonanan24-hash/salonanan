alter table public.home_ads drop constraint if exists home_ads_placement_check;

alter table public.home_ads
  add constraint home_ads_placement_check
  check (placement in ('hero', 'square', 'section', 'packages'));

notify pgrst, 'reload schema';
