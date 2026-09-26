-- Optional diagnostic only. This does not modify anything.
select
  (select count(*) from public.dishes) as dishes,
  (select count(*) from public.ingredients) as ingredients,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items;
