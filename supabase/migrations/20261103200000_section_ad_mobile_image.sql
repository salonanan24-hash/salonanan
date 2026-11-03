-- Optional mobile image for section ads (hero-like size on small screens).

alter table public.home_ads
  add column if not exists image_mobile_src text not null default '';

notify pgrst, 'reload schema';
