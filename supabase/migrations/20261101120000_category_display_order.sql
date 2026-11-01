alter table public.categories
  add column if not exists display_order integer;

alter table public.categories
  drop constraint if exists categories_display_order_check;

alter table public.categories
  add constraint categories_display_order_check
  check (display_order is null or (display_order >= 0 and display_order <= 9999));

notify pgrst, 'reload schema';
