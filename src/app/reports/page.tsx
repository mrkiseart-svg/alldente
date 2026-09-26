import {redirect} from 'next/navigation';
import Nav from '@/components/layout/Nav';
import ReportCharts from '@/components/reports/ReportCharts';
import ArchiveReportingButton from '@/components/admin/ArchiveReportingButton';
import {canSeeAllReports,getSessionContext} from '@/lib/auth';
import {money} from '@/lib/format';
import {Wallet,Carrot,TrendingUp,Utensils,Archive} from 'lucide-react';

type OrderRow={id:string;worker_id:string;worker_name:string;total:number|string;created_at:string;order_items?:Array<{quantity:number;cost_price:number|string;dishes?:{name?:string|null}|null}>};
type WorkerSummary={id:string;name:string;checks:number;revenue:number;cost:number;portions:number};
type ArchiveRow={id:string;period:string;revenue:number|string;profit:number|string;archived_at:string};
type ProfileRow={id:string;full_name:string|null;login:string|null;role?:string|null};
type TeamMember={id:string;name:string};

export default async function Reports({searchParams}:{searchParams:Promise<{from?:string;to?:string;worker?:string}>}){
  const params=await searchParams;
  const validDate=(v?:string)=>!!v&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v));
  const from=validDate(params.from)?params.from:undefined,to=validDate(params.to)?params.to:undefined;
  const ctx=await getSessionContext();if(!ctx)redirect('/login');
  const expanded=canSeeAllReports(ctx.profile.role);
  let error='';if(from&&to&&from>to)error='Начало периода должно быть раньше окончания.';

  const [{data:profiles},{data:archiveData}]=await Promise.all([
    expanded?ctx.sb.from('profiles').select('id,full_name,login,role').order('full_name'):Promise.resolve({data:[ctx.profile]} as any),
    expanded?ctx.sb.from('report_archives').select('id,period,revenue,profit,archived_at').order('archived_at',{ascending:false}).limit(24):Promise.resolve({data:[]} as any),
  ]);
  const archives=(archiveData||[]) as ArchiveRow[];
  const profileRows=(profiles||[]) as unknown as ProfileRow[];
  const team:TeamMember[]=profileRows.map((p:ProfileRow)=>({
    id:String(p.id),
    name:String(p.full_name||p.login||'Сотрудник'),
  }));
  const requestedWorker=expanded&&params.worker&&team.some(p=>p.id===params.worker)?params.worker:undefined;
  const scopeWorkerId=expanded?requestedWorker:ctx.user.id;
  const scopeName=scopeWorkerId?(team.find(p=>p.id===scopeWorkerId)?.name||ctx.profile.full_name):undefined;

  const orders:OrderRow[]=[];
  if(!error)for(let offset=0;;offset+=1000){
    let query=ctx.sb.from('orders').select('id,worker_id,worker_name,total,created_at,order_items(quantity,cost_price,dishes(name))').order('created_at').order('id').range(offset,offset+999);
    if(scopeWorkerId)query=query.eq('worker_id',scopeWorkerId);
    if(from)query=query.gte('created_at',from+'T00:00:00+07:00');
    if(to){const end=new Date(to+'T00:00:00+07:00');end.setUTCDate(end.getUTCDate()+1);query=query.lt('created_at',end.toISOString())}
    const{data,error:e}=await query;if(e){error='Не удалось загрузить отчёт. Обновите страницу.';break}
    orders.push(...((data||[]) as unknown as OrderRow[]));if(!data||data.length<1000)break
  }

  const items=orders.flatMap(o=>o.order_items||[]);
  const revenue=orders.reduce((s,o)=>s+Number(o.total||0),0),cost=items.reduce((s,i)=>s+Number(i.cost_price)*Number(i.quantity),0),portions=items.reduce((s,i)=>s+Number(i.quantity),0);
  const dishMap=new Map<string,number>();items.forEach(i=>{const name=i.dishes?.name||'Удалённое блюдо';dishMap.set(name,(dishMap.get(name)||0)+Number(i.quantity))});

  const profileNames=new Map<string,string>(team.map((p:TeamMember)=>[p.id,p.name]));
  const workerMap=new Map<string,WorkerSummary>();
  if(expanded&&!requestedWorker){
    orders.forEach(o=>{const row:WorkerSummary=workerMap.get(o.worker_id)||{id:o.worker_id,name:profileNames.get(o.worker_id)||o.worker_name||'Сотрудник',checks:0,revenue:0,cost:0,portions:0};row.checks+=1;row.revenue+=Number(o.total||0);for(const i of o.order_items||[]){row.cost+=Number(i.cost_price)*Number(i.quantity);row.portions+=Number(i.quantity)}workerMap.set(o.worker_id,row)});
    team.forEach((p:TeamMember)=>{if(!workerMap.has(p.id))workerMap.set(p.id,{id:p.id,name:p.name,checks:0,revenue:0,cost:0,portions:0})});
  }
  const summaries=[...workerMap.values()].sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name,'ru'));
  const buildWorkerHref=(id:string)=>{const q=new URLSearchParams();if(from)q.set('from',from);if(to)q.set('to',to);q.set('worker',id);return `/reports?${q.toString()}`};

  return <main className="shell"><Nav name={ctx.profile.full_name} role={ctx.profile.role}/><div className="reportHeader"><div><div className="eyebrow">I NUMERI DELLA CUCINA · ЦИФРЫ КУХНИ</div><h1 className="pageTitle">Хороший вкус <em>в цифрах</em></h1><p className="sub">{expanded?(scopeName?`Продажи сотрудника: ${scopeName}.`:'Продажи всей команды и детализация по каждому сотруднику.'):'Ваши личные продажи, блюда и результаты работы.'}</p></div>{expanded&&<ArchiveReportingButton/>}</div>
  {expanded&&archives.length>0&&<section className="archiveSection"><div className="sectionHeading"><h2>Архив прошлых периодов</h2><span>Краткая история закрытых отчётов</span></div><div className="archiveCards">{archives.map(a=><article className="panel archiveCard" key={a.id}><div className="archiveCardTitle"><Archive size={17}/><b>{a.period}</b></div><div><span>Выручка</span><strong>{money(Number(a.revenue||0))}</strong></div><div><span>Прибыль</span><strong>{money(Number(a.profit||0))}</strong></div></article>)}</div></section>}
  <form className="reportPeriod"><label>С <input type="date" name="from" defaultValue={from}/></label><label>по <input type="date" name="to" defaultValue={to}/></label>{expanded&&<label>Сотрудник <select name="worker" defaultValue={requestedWorker||''}><option value="">Вся команда</option>{team.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<button className="pill active">Показать</button><a className="pill" href="/reports">За всё время</a></form><p className="sub">{expanded?(scopeName?`Сотрудник: ${scopeName}`:'Общая отчётность'):'Личная отчётность'} · {orders.length} чеков · время UTC+7</p>{error?<p className="error" role="alert">{error}</p>:<><div className="reportGrid">{[['Выручка',money(revenue),Wallet],['Себестоимость',money(cost),Carrot],['Валовая прибыль',money(revenue-cost),TrendingUp],['Подано порций',String(portions),Utensils]].map(([label,value,Icon]:any)=><div className="panel stat" key={label}><Icon size={23}/><small>{label}</small><strong>{value}</strong></div>)}</div>{expanded&&!requestedWorker&&<section className="workerReport"><div className="sectionHeading"><h2>Продажи по сотрудникам</h2><span>Имя берётся из регистрации пользователя</span></div><div className="panel tableWrap"><table className="table"><thead><tr><th>Сотрудник</th><th>Чеки</th><th>Выручка</th><th>Себестоимость</th><th>Валовая прибыль</th><th>Порции</th><th></th></tr></thead><tbody>{summaries.map(w=><tr key={w.id}><td><b>{w.name}</b></td><td>{w.checks}</td><td>{money(w.revenue)}</td><td>{money(w.cost)}</td><td>{money(w.revenue-w.cost)}</td><td>{w.portions}</td><td><a className="pill compact" href={buildWorkerHref(w.id)}>Открыть отчёт</a></td></tr>)}</tbody></table></div></section>}<ReportCharts entries={[...dishMap.entries()]}/><p className="sub" style={{marginTop:20,fontSize:11}}>Выручка учитывает скидки. Валовая прибыль = выручка − себестоимость ингредиентов на момент заказа; прочие расходы не включены.</p></>}</main>
}
