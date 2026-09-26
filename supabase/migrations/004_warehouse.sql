-- Warehouse inventory and atomic ingredient consumption.
-- Run after 003_roles_and_permissions.sql.

alter table public.ingredients
  add column if not exists stock_quantity numeric(14,3) not null default 0;

alter table public.ingredients drop constraint if exists ingredients_stock_quantity_check;
alter table public.ingredients
  add constraint ingredients_stock_quantity_check check(stock_quantity >= 0);

-- Fix two legacy recipe keys so they match ingredient names in the warehouse.
update public.dishes
set recipe=(recipe - 'Лепешки') || jsonb_build_object('Лепешка',recipe->'Лепешки'), updated_at=now()
where recipe ? 'Лепешки' and not (recipe ? 'Лепешка');

update public.dishes
set recipe=(recipe - 'Повареная соль') || jsonb_build_object('Поваренная соль',recipe->'Повареная соль'), updated_at=now()
where recipe ? 'Повареная соль' and not (recipe ? 'Поваренная соль');

-- Orders, receipt creation and stock deduction are one transaction.
-- Ingredient rows are locked in name order to prevent overselling under concurrent checkouts.
create or replace function public.place_order(p_items jsonb, p_discount numeric default 0)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_subtotal numeric:=0;
  v_discount numeric;
  v_item record;
  v_dish public.dishes%rowtype;
  v_name text;
  v_need record;
  v_stock public.ingredients%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid items'; end if;
  if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then raise exception 'Invalid item count'; end if;
  if p_discount is null or p_discount::text='NaN' or p_discount<0 or p_discount>100 then raise exception 'Invalid discount'; end if;

  -- Lock dishes and validate current prices/availability.
  perform 1
  from public.dishes
  where id in (select (value->>'dish_id')::uuid from jsonb_array_elements(p_items))
  order by id
  for share;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item.value->>'quantity','') !~ '^[0-9]+$' then raise exception 'Invalid quantity'; end if;
    if (v_item.value->>'quantity')::int not between 1 and 999 then raise exception 'Invalid quantity'; end if;
    select * into v_dish from public.dishes where id=(v_item.value->>'dish_id')::uuid and active=true;
    if not found then raise exception 'Dish unavailable'; end if;
    v_subtotal:=v_subtotal+v_dish.sale_price*(v_item.value->>'quantity')::int;
  end loop;

  -- Validate and lock all ingredients required by the complete order.
  for v_need in
    with requested as (
      select (value->>'dish_id')::uuid as dish_id,(value->>'quantity')::numeric as quantity
      from jsonb_array_elements(p_items)
    ), needed as (
      select r.key as ingredient_name,sum((r.value)::numeric * requested.quantity) as quantity
      from requested
      join public.dishes d on d.id=requested.dish_id
      cross join lateral jsonb_each_text(d.recipe) r(key,value)
      group by r.key
    )
    select ingredient_name,quantity from needed order by ingredient_name
  loop
    select * into v_stock from public.ingredients where name=v_need.ingredient_name for update;
    if not found then
      raise exception 'Ингредиент отсутствует на складе: %',v_need.ingredient_name;
    end if;
    if v_stock.stock_quantity < v_need.quantity then
      raise exception 'Недостаточно на складе: % (нужно %, есть %)',v_need.ingredient_name,v_need.quantity,v_stock.stock_quantity;
    end if;
  end loop;

  select full_name into v_name from public.profiles where id=auth.uid();
  v_discount:=round(v_subtotal*p_discount/100,2);

  insert into public.orders(worker_id,worker_name,subtotal,discount_percent,discount_amount,total)
  values(auth.uid(),coalesce(v_name,'Сотрудник'),v_subtotal,p_discount,v_discount,v_subtotal-v_discount)
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_dish from public.dishes where id=(v_item.value->>'dish_id')::uuid;
    insert into public.order_items(order_id,dish_id,quantity,unit_price,cost_price,total)
    values(v_id,v_dish.id,(v_item.value->>'quantity')::int,v_dish.sale_price,v_dish.cost_price,v_dish.sale_price*(v_item.value->>'quantity')::int);
  end loop;

  -- Deduct the aggregated recipe requirements from inventory.
  for v_need in
    with requested as (
      select (value->>'dish_id')::uuid as dish_id,(value->>'quantity')::numeric as quantity
      from jsonb_array_elements(p_items)
    ), needed as (
      select r.key as ingredient_name,sum((r.value)::numeric * requested.quantity) as quantity
      from requested
      join public.dishes d on d.id=requested.dish_id
      cross join lateral jsonb_each_text(d.recipe) r(key,value)
      group by r.key
    )
    select ingredient_name,quantity from needed
  loop
    update public.ingredients
    set stock_quantity=stock_quantity-v_need.quantity,updated_at=now()
    where name=v_need.ingredient_name;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.place_order(jsonb,numeric) from public;
grant execute on function public.place_order(jsonb,numeric) to authenticated;
