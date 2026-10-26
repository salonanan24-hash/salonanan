alter table public.home_ads drop constraint if exists home_ads_target_kind_check;

alter table public.home_ads add constraint home_ads_target_kind_check
  check (target_kind in ('none', 'category', 'subcategory', 'brand', 'product', 'package'));
