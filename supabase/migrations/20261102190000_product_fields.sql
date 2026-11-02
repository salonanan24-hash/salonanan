-- Move spec/feature field definitions from categories to products.

create table if not exists public.product_fields (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  label_he text not null,
  label_ar text not null,
  field_type text not null check (field_type in ('text', 'number', 'boolean')),
  section text not null default 'features' check (section in ('spec', 'features', 'info')),
  sort_order integer not null default 0
);

create index if not exists product_fields_product_id_idx on public.product_fields (product_id);

alter table public.product_fields enable row level security;
grant select, insert, update, delete on public.product_fields to service_role;
revoke all on public.product_fields from anon, authenticated;

-- Clone only category fields that a product actually uses.
with used as (
  select distinct ps.product_id, ps.field_id
  from public.product_specs ps
  union
  select distinct pv.product_id, vs.field_id
  from public.variant_specs vs
  join public.product_variants pv on pv.id = vs.variant_id
)
insert into public.product_fields (id, product_id, label_he, label_ar, field_type, section, sort_order)
select
  'field-' || substr(md5(u.product_id || ':' || u.field_id), 1, 24),
  u.product_id,
  cf.label_he,
  cf.label_ar,
  cf.field_type,
  cf.section,
  cf.sort_order
from used u
join public.category_fields cf on cf.id = u.field_id
on conflict (id) do nothing;

-- Remap product_specs to the new product-owned field ids.
alter table public.product_specs drop constraint if exists product_specs_field_id_fkey;

create temporary table product_specs_remap on commit drop as
select
  ps.product_id,
  'field-' || substr(md5(ps.product_id || ':' || ps.field_id), 1, 24) as field_id,
  ps.value,
  coalesce(ps.value_ar, '') as value_ar
from public.product_specs ps
where exists (
  select 1
  from public.product_fields pf
  where pf.id = 'field-' || substr(md5(ps.product_id || ':' || ps.field_id), 1, 24)
);

delete from public.product_specs;

alter table public.product_specs
  add constraint product_specs_field_id_fkey
  foreign key (field_id) references public.product_fields (id) on delete cascade;

insert into public.product_specs (product_id, field_id, value, value_ar)
select product_id, field_id, value, value_ar
from product_specs_remap;

-- Remap variant_specs the same way.
alter table public.variant_specs drop constraint if exists variant_specs_field_id_fkey;

create temporary table variant_specs_remap on commit drop as
select
  vs.variant_id,
  'field-' || substr(md5(pv.product_id || ':' || vs.field_id), 1, 24) as field_id,
  vs.value,
  coalesce(vs.value_ar, '') as value_ar
from public.variant_specs vs
join public.product_variants pv on pv.id = vs.variant_id
where exists (
  select 1
  from public.product_fields pf
  where pf.id = 'field-' || substr(md5(pv.product_id || ':' || vs.field_id), 1, 24)
);

delete from public.variant_specs;

alter table public.variant_specs
  add constraint variant_specs_field_id_fkey
  foreign key (field_id) references public.product_fields (id) on delete cascade;

insert into public.variant_specs (variant_id, field_id, value, value_ar)
select variant_id, field_id, value, value_ar
from variant_specs_remap;

drop table if exists public.category_fields;

notify pgrst, 'reload schema';
