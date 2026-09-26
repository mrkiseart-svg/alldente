import {NextResponse} from 'next/server';
import {canSeeAllReports,getSessionContext} from '@/lib/auth';

export async function POST(req:Request){
  try{
    const ctx=await getSessionContext();
    if(!ctx)return NextResponse.json({error:'Войдите в аккаунт'},{status:401});
    if(!canSeeAllReports(ctx.profile.role))return NextResponse.json({error:'Недостаточно прав'},{status:403});
    const body=await req.json();
    const period=typeof body?.period==='string'?body.period.trim():'';
    if(period.length<2||period.length>120)return NextResponse.json({error:'Укажите период'},{status:400});
    const {data,error}=await ctx.sb.rpc('archive_reporting_period',{p_period:period});
    if(error){
      const message=/No receipts/i.test(error.message)?'Нет чеков для архивации':error.message||'Не удалось архивировать период';
      return NextResponse.json({error:message},{status:400});
    }
    const archive=Array.isArray(data)?data[0]:data;
    return NextResponse.json({archive});
  }catch{return NextResponse.json({error:'Не удалось обработать запрос'},{status:400})}
}
