-- Role model: worker / manager / creator.
-- Existing installations: first legacy admin becomes creator; if there was no admin,
-- the oldest existing profile becomes creator so role management is never locked out.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role set default 'worker';

update public.profiles set role='worker' where role='employee';

do $$
declare v_creator uuid;
begin
  if not exists(select 1 from public.profiles where role='creator') then
    select id into v_creator from public.profiles where role='admin' order by created_at,id limit 1;
    if v_creator is not null then
      update public.profiles set role='creator' where id=v_creator;
    end if;
  end if;
  update public.profiles set role='manager' where role='admin';
  if not exists(select 1 from public.profiles where role='creator') then
    select id into v_creator from public.profiles order by created_at,id limit 1;
    if v_creator is not null then
      update public.profiles set role='creator' where id=v_creator;
    end if;
  end if;
end $$;

alter table public.profiles add constraint profiles_role_check check(role in ('worker','manager','creator'));

create or replace function public.current_user_role()
returns text
language sql stable security definer set search_path=public
as $$
  select coalesce((select role from public.profiles where id=auth.uid()),'worker');
$$;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- First account on a fresh installation becomes creator; all subsequent signups are workers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role text:='worker';
begin
  perform pg_advisory_xact_lock(731947);
  if not exists(select 1 from public.profiles where role='creator') then v_role:='creator'; end if;
  insert into public.profiles(id,login,full_name,role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'login',split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
    v_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- RLS: everyone can read the menu; only manager/creator can change prices.
drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using(
  auth.uid()=id or public.current_user_role() in ('manager','creator')
);

drop policy if exists ingredients_auth on public.ingredients;
drop policy if exists ingredients_read on public.ingredients;
drop policy if exists ingredients_insert_manage on public.ingredients;
drop policy if exists ingredients_update_manage on public.ingredients;
drop policy if exists ingredients_delete_manage on public.ingredients;
create policy ingredients_read on public.ingredients for select using(auth.uid() is not null);
create policy ingredients_insert_manage on public.ingredients for insert with check(public.current_user_role() in ('manager','creator'));
create policy ingredients_update_manage on public.ingredients for update using(public.current_user_role() in ('manager','creator')) with check(public.current_user_role() in ('manager','creator'));
create policy ingredients_delete_manage on public.ingredients for delete using(public.current_user_role() in ('manager','creator'));

drop policy if exists dishes_auth on public.dishes;
drop policy if exists dishes_read on public.dishes;
drop policy if exists dishes_insert_manage on public.dishes;
drop policy if exists dishes_update_manage on public.dishes;
drop policy if exists dishes_delete_manage on public.dishes;
create policy dishes_read on public.dishes for select using(auth.uid() is not null);
create policy dishes_insert_manage on public.dishes for insert with check(public.current_user_role() in ('manager','creator'));
create policy dishes_update_manage on public.dishes for update using(public.current_user_role() in ('manager','creator')) with check(public.current_user_role() in ('manager','creator'));
create policy dishes_delete_manage on public.dishes for delete using(public.current_user_role() in ('manager','creator'));

-- Workers only see their own orders; manager/creator see the whole team.
drop policy if exists orders_self on public.orders;
drop policy if exists orders_read on public.orders;
drop policy if exists orders_insert_self on public.orders;
create policy orders_read on public.orders for select using(
  auth.uid()=worker_id or public.current_user_role() in ('manager','creator')
);
create policy orders_insert_self on public.orders for insert with check(auth.uid()=worker_id);

drop policy if exists items_self on public.order_items;
drop policy if exists items_read on public.order_items;
drop policy if exists items_insert_self on public.order_items;
create policy items_read on public.order_items for select using(
  exists(
    select 1 from public.orders o
    where o.id=order_id and (o.worker_id=auth.uid() or public.current_user_role() in ('manager','creator'))
  )
);
create policy items_insert_self on public.order_items for insert with check(
  exists(select 1 from public.orders o where o.id=order_id and o.worker_id=auth.uid())
);

-- Creator-only role assignment. The last creator cannot be removed accidentally.
create or replace function public.set_profile_role(p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
declare v_old_role text; v_creator_count integer;
begin
  if auth.uid() is null or public.current_user_role()<>'creator' then raise exception 'Creator access required'; end if;
  if p_role not in ('worker','manager','creator') then raise exception 'Invalid role'; end if;
  select role into v_old_role from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if p_user_id=auth.uid() and p_role<>'creator' then raise exception 'You cannot remove your own creator role'; end if;
  if v_old_role='creator' and p_role<>'creator' then
    select count(*) into v_creator_count from public.profiles where role='creator';
    if v_creator_count<=1 then raise exception 'At least one creator is required'; end if;
  end if;
  update public.profiles set role=p_role where id=p_user_id;
end;
$$;
revoke all on function public.set_profile_role(uuid,text) from public;
grant execute on function public.set_profile_role(uuid,text) to authenticated;

-- Reports are derived from orders, so deleting orders clears both receipts and reporting.
create or replace function public.clear_reporting_data()
returns bigint language plpgsql security definer set search_path=public as $$
declare v_count bigint;
begin
  if auth.uid() is null or public.current_user_role() not in ('manager','creator') then raise exception 'Manager access required'; end if;
  select count(*) into v_count from public.orders;
  delete from public.orders;
  return v_count;
end;
$$;
revoke all on function public.clear_reporting_data() from public;
grant execute on function public.clear_reporting_data() to authenticated;
