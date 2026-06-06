-- Homepage catalog: independent products + categories pool for the new front page.

create table if not exists public.homepage_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  parent_id uuid references public.homepage_categories(id) on delete set null,
  sort_order integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.homepage_categories to anon, authenticated;
grant all on public.homepage_categories to service_role;

alter table public.homepage_categories enable row level security;

create policy "Homepage categories public read"
  on public.homepage_categories for select
  using (is_active = true);

create policy "Homepage categories super admin all"
  on public.homepage_categories for all
  to authenticated
  using (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  with check (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));


create table if not exists public.homepage_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  images text[] not null default '{}'::text[],
  category_id uuid references public.homepage_categories(id) on delete set null,
  source_url text,
  source_site text,
  sku text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists homepage_products_source_url_uq
  on public.homepage_products(source_url)
  where source_url is not null;

create index if not exists homepage_products_category_idx
  on public.homepage_products(category_id);

grant select on public.homepage_products to anon, authenticated;
grant all on public.homepage_products to service_role;

alter table public.homepage_products enable row level security;

create policy "Homepage products public read"
  on public.homepage_products for select
  using (is_active = true);

create policy "Homepage products super admin all"
  on public.homepage_products for all
  to authenticated
  using (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  with check (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

drop trigger if exists homepage_products_updated_at on public.homepage_products;
create trigger homepage_products_updated_at
  before update on public.homepage_products
  for each row execute function public.update_updated_at_column();
