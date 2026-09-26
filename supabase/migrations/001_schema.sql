create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade, login text unique not null, full_name text not null, role text not null default 'employee' check(role in ('employee','admin')), created_at timestamptz default now());
create table if not exists public.ingredients(id uuid primary key default gen_random_uuid(),name text unique not null,price numeric(12,2) not null default 0,unit text default 'шт',updated_at timestamptz default now());
create table if not exists public.dishes(id uuid primary key default gen_random_uuid(),name text unique not null,sale_price numeric(12,2) not null default 0,cost_price numeric(12,2) not null default 0,recipe jsonb not null default '{}'::jsonb,category text not null default 'Другое',image_url text,active boolean not null default true,updated_at timestamptz default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),worker_id uuid not null references auth.users(id),worker_name text not null,subtotal numeric(12,2) not null,discount_percent numeric(5,2) not null default 0,discount_amount numeric(12,2) not null default 0,total numeric(12,2) not null,created_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,dish_id uuid references public.dishes(id),quantity integer not null check(quantity>0),unit_price numeric(12,2) not null,cost_price numeric(12,2) not null,total numeric(12,2) not null);
alter table public.profiles enable row level security; alter table public.ingredients enable row level security; alter table public.dishes enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security;
drop policy if exists profiles_self on public.profiles; create policy profiles_self on public.profiles for select using(auth.uid()=id);
drop policy if exists ingredients_auth on public.ingredients; create policy ingredients_auth on public.ingredients for all using(auth.role()='authenticated') with check(auth.role()='authenticated');
drop policy if exists dishes_auth on public.dishes; create policy dishes_auth on public.dishes for all using(auth.role()='authenticated') with check(auth.role()='authenticated');
drop policy if exists orders_self on public.orders; create policy orders_self on public.orders for all using(auth.uid()=worker_id) with check(auth.uid()=worker_id);
drop policy if exists items_self on public.order_items; create policy items_self on public.order_items for all using(exists(select 1 from public.orders o where o.id=order_id and o.worker_id=auth.uid())) with check(exists(select 1 from public.orders o where o.id=order_id and o.worker_id=auth.uid()));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,login,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'login',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1))); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();


-- Keep dish cost price synchronized with ingredient prices stored in recipe JSON.
create or replace function public.recalculate_dish_costs() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update public.dishes d
  set cost_price = coalesce((select sum(i.price * (value::text)::numeric) from jsonb_each_text(d.recipe) r(name,value) join public.ingredients i on i.name=r.name),0), updated_at=now();
  return new;
end; $$;

drop trigger if exists ingredients_cost_refresh on public.ingredients;
create trigger ingredients_cost_refresh after insert or update of price or delete on public.ingredients
for each statement execute function public.recalculate_dish_costs();
