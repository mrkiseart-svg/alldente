-- Run once after 001_schema.sql. Prices are read on the server; the whole order is atomic.
create or replace function public.place_order(p_items jsonb, p_discount numeric default 0)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_subtotal numeric:=0; v_discount numeric; v_item record; v_dish public.dishes%rowtype; v_name text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid items'; end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then raise exception 'Invalid item count'; end if;
 if p_discount is null or p_discount::text='NaN' or p_discount<0 or p_discount>100 then raise exception 'Invalid discount'; end if;
 -- Lock all selected dishes in a stable order to keep prices consistent throughout checkout.
 perform 1 from public.dishes where id in (select (value->>'dish_id')::uuid from jsonb_array_elements(p_items)) order by id for share;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if coalesce(v_item.value->>'quantity','') !~ '^[0-9]+$' then raise exception 'Invalid quantity'; end if;
   if (v_item.value->>'quantity')::int not between 1 and 999 then raise exception 'Invalid quantity'; end if;
   select * into v_dish from public.dishes where id=(v_item.value->>'dish_id')::uuid and active=true;
   if not found then raise exception 'Dish unavailable'; end if;
   v_subtotal:=v_subtotal+v_dish.sale_price*(v_item.value->>'quantity')::int;
 end loop;
 select full_name into v_name from public.profiles where id=auth.uid();
 v_discount:=round(v_subtotal*p_discount/100,2);
 insert into public.orders(worker_id,worker_name,subtotal,discount_percent,discount_amount,total)
 values(auth.uid(),coalesce(v_name,'Сотрудник'),v_subtotal,p_discount,v_discount,v_subtotal-v_discount) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
   select * into v_dish from public.dishes where id=(v_item.value->>'dish_id')::uuid;
   insert into public.order_items(order_id,dish_id,quantity,unit_price,cost_price,total)
   values(v_id,v_dish.id,(v_item.value->>'quantity')::int,v_dish.sale_price,v_dish.cost_price,v_dish.sale_price*(v_item.value->>'quantity')::int);
 end loop;
 return v_id;
end; $$;
revoke all on function public.place_order(jsonb,numeric) from public;
grant execute on function public.place_order(jsonb,numeric) to authenticated;
