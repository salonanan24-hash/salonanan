alter table public.brands
  add column if not exists image_src text not null default '';

notify pgrst, 'reload schema';
