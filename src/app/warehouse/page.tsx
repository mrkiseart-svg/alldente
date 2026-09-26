import {redirect} from 'next/navigation';
import Nav from '@/components/layout/Nav';
import WarehouseClient from '@/components/inventory/WarehouseClient';
import {getSessionContext} from '@/lib/auth';
import type {StockIngredient} from '@/types';

export default async function WarehousePage(){
  const ctx=await getSessionContext();
  if(!ctx)redirect('/login');
  const {data}=await ctx.sb.from('ingredients').select('id,name,unit,stock_quantity').order('name');
  return <main className="shell"><Nav name={ctx.profile.full_name} role={ctx.profile.role}/><div className="reportHeader"><div><div className="eyebrow">INVENTARIO · СКЛАД</div><h1 className="pageTitle">Остатки <em>ингредиентов</em></h1><p className="sub">После оформления заказа ингредиенты автоматически списываются по рецептуре блюда.</p></div></div><WarehouseClient ingredients={(data||[]) as StockIngredient[]} role={ctx.profile.role}/></main>
}
