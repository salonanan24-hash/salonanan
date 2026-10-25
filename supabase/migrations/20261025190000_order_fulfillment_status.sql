alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('placed', 'processing', 'ready', 'shipping', 'completed', 'cancelled'));

notify pgrst, 'reload schema';
