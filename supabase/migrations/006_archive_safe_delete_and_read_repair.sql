-- Hotfix: archive deletion compatible with Supabase safe-update protection,
-- plus explicit read policies for menu/warehouse data.
-- Run after 005_archive_and_batch_inventory.sql.

-- Re-assert authenticated read access. These policies are idempotent and do not
-- grant write access to workers.
drop policy if exists ingredients_read on public.ingredients;
create policy ingredients_read on public.ingredients
for select using (auth.uid() is not null);

drop policy if exists dishes_read on public.dishes;
create policy dishes_read on public.dishes
for select using (auth.uid() is not null);

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

  perform pg_advisory_xact_lock(731952);
  lock table public.orders in share row exclusive mode;
  lock table public.order_items in share row exclusive mode;

  select count(*)::integer,coalesce(sum(total),0)::numeric(14,2)
  into v_checks,v_revenue
  from public.orders;

  if v_checks=0 then
    raise exception 'No receipts to archive';
  end if;

  select coalesce(sum(oi.cost_price*oi.quantity),0)::numeric(14,2)
  into v_cost
  from public.order_items oi;

  insert into public.report_archives(period,revenue,cost,profit,checks_count,archived_by)
  values(v_period,v_revenue,v_cost,(v_revenue-v_cost)::numeric(14,2),v_checks,auth.uid())
  returning * into v_archive;

  -- Explicit primary-key predicate keeps Supabase safe-update protection happy.
  -- order_items are removed by ON DELETE CASCADE.
  delete from public.orders
  where id is not null;

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
