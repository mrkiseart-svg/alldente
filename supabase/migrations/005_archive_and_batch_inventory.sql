-- Archive reporting periods, batch warehouse saving and menu correction.
-- Run after 004_warehouse.sql.

create table if not exists public.report_archives(
  id uuid primary key default gen_random_uuid(),
  period text not null,
  revenue numeric(14,2) not null default 0,
  cost numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  checks_count integer not null default 0,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz not null default now()
);

alter table public.report_archives enable row level security;

drop policy if exists report_archives_read_manage on public.report_archives;
create policy report_archives_read_manage on public.report_archives
for select using(public.current_user_role() in ('manager','creator'));

-- Save all edited warehouse balances in one database transaction.
create or replace function public.save_inventory_levels(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_qty numeric;
  v_updated integer:=0;
  v_rows integer;
begin
  if auth.uid() is null or public.current_user_role() not in ('manager','creator') then
    raise exception 'Manager access required';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>1000 then
    raise exception 'Invalid inventory items';
  end if;

  -- Lock every affected row before applying any changes.
  perform 1
  from public.ingredients i
  where i.id in (
    select (value->>'id')::uuid
    from jsonb_array_elements(p_items)
  )
  order by i.id
  for update;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'id','')='' or coalesce(v_item->>'stock_quantity','')='' then
      raise exception 'Invalid inventory item';
    end if;
    v_id:=(v_item->>'id')::uuid;
    v_qty:=round((v_item->>'stock_quantity')::numeric,3);
    if v_qty<0 or v_qty>99999999999 then raise exception 'Invalid stock quantity'; end if;

    update public.ingredients
    set stock_quantity=v_qty,updated_at=now()
    where id=v_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Ingredient not found'; end if;
    v_updated:=v_updated+1;
  end loop;

  return v_updated;
end;
$$;
revoke all on function public.save_inventory_levels(jsonb) from public;
grant execute on function public.save_inventory_levels(jsonb) to authenticated;

-- Save a compact snapshot, then clear the current receipts/reporting in the same transaction.
create or replace function public.archive_reporting_period(p_period text)
returns table(
  archive_id uuid,
  archive_period text,
  archive_revenue numeric,
  archive_profit numeric,
  archive_checks_count integer,
  archive_archived_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_period text:=btrim(coalesce(p_period,''));
  v_revenue numeric(14,2):=0;
  v_cost numeric(14,2):=0;
  v_checks integer:=0;
  v_archive public.report_archives%rowtype;
begin
  if auth.uid() is null or public.current_user_role() not in ('manager','creator') then
    raise exception 'Manager access required';
  end if;
  if char_length(v_period)<2 or char_length(v_period)>120 then
    raise exception 'Period is required';
  end if;

  -- Do not allow two archive operations to overlap, and block new receipts until
  -- the snapshot + deletion transaction is finished.
  perform pg_advisory_xact_lock(731952);
  lock table public.orders in share row exclusive mode;
  lock table public.order_items in share row exclusive mode;

  select count(*)::integer,coalesce(sum(total),0)::numeric(14,2)
  into v_checks,v_revenue
  from public.orders;

  if v_checks=0 then raise exception 'No receipts to archive'; end if;

  select coalesce(sum(oi.cost_price*oi.quantity),0)::numeric(14,2)
  into v_cost
  from public.order_items oi;

  insert into public.report_archives(period,revenue,cost,profit,checks_count,archived_by)
  values(v_period,v_revenue,v_cost,(v_revenue-v_cost)::numeric(14,2),v_checks,auth.uid())
  returning * into v_archive;

  -- order_items are removed by ON DELETE CASCADE.
  delete from public.orders where id is not null;

  return query select
    v_archive.id,
    v_archive.period,
    v_archive.revenue,
    v_archive.profit,
    v_archive.checks_count,
    v_archive.archived_at;
end;
$$;
revoke all on function public.archive_reporting_period(text) from public;
grant execute on function public.archive_reporting_period(text) to authenticated;

-- Retire the old destructive reset RPC; archive_reporting_period replaces it.
drop function if exists public.clear_reporting_data();

-- "Куриный бульон" is a preparatory ingredient/product, not a soup for the menu.
update public.dishes
set category='Другое',updated_at=now()
where name='Куриный бульон';
