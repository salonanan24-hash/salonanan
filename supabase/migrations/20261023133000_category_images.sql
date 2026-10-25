alter table public.categories
  add column if not exists image_src text not null default '';

alter table public.subcategories
  add column if not exists image_src text not null default '';

notify pgrst, 'reload schema';
