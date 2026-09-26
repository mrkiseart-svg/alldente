import {NextResponse} from 'next/server';
import {canManageWarehouse,getSessionContext} from '@/lib/auth';

type InventoryUpdate={id:string;stock_quantity:number};

export async function PATCH(req:Request){
  try{
    const ctx=await getSessionContext();
    if(!ctx)return NextResponse.json({error:'Войдите в аккаунт'},{status:401});
    if(!canManageWarehouse(ctx.profile.role))return NextResponse.json({error:'Изменять склад может только менеджер или создатель'},{status:403});
    const body=await req.json();
    const items:InventoryUpdate[]=Array.isArray(body?.items)?body.items:[];
    if(!items.length||items.length>1000)return NextResponse.json({error:'Нет изменений для сохранения'},{status:400});
    const normalized:InventoryUpdate[]=[];
    for(const item of items){
      if(!item||typeof item.id!=='string'||typeof item.stock_quantity!=='number'||!Number.isFinite(item.stock_quantity)||item.stock_quantity<0||item.stock_quantity>99999999999){
        return NextResponse.json({error:'Некорректный остаток'},{status:400});
      }
      normalized.push({id:item.id,stock_quantity:Math.round(item.stock_quantity*1000)/1000});
    }
    const {data,error}=await ctx.sb.rpc('save_inventory_levels',{p_items:normalized});
    if(error)return NextResponse.json({error:error.message||'Не удалось сохранить склад'},{status:400});
    return NextResponse.json({updated:Number(data||0)});
  }catch{return NextResponse.json({error:'Не удалось обработать запрос'},{status:400})}
}
