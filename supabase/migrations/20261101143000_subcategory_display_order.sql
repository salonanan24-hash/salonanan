alter table public.subcategories
  add column if not exists display_order integer;

alter table public.subcategories
  drop constraint if exists subcategories_display_order_check;

alter table public.subcategories
  add constraint subcategories_display_order_check
  check (display_order is null or (display_order >= 0 and display_order <= 9999));

notify pgrst, 'reload schema';
