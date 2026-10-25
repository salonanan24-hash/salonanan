grant select on public.orders to authenticated;

drop policy if exists orders_admin_read on public.orders;

create policy orders_admin_read
  on public.orders
  for select
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'salonanan24@gmail.com');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

notify pgrst, 'reload schema';
