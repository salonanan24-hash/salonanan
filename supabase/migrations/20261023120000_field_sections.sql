-- Groups a category field into one product-page section.

alter table public.category_fields
  add column if not exists section text not null default 'features';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'category_fields_section_check'
  ) then
    alter table public.category_fields
      add constraint category_fields_section_check
      check (section in ('spec', 'features', 'info'));
  end if;
end $$;

notify pgrst, 'reload schema';
