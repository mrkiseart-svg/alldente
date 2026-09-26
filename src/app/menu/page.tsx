import {redirect} from 'next/navigation';
import Nav from '@/components/layout/Nav';
import MenuClient from '@/components/menu/MenuClient';
import {getSessionContext} from '@/lib/auth';
import {categoryFor} from '@/lib/categories';
export default async function Menu(){const ctx=await getSessionContext();if(!ctx)redirect('/login');const [{data},{data:inventory}]=await Promise.all([ctx.sb.from('dishes').select('*').eq('active',true).order('name'),ctx.sb.from('ingredients').select('name,unit,stock_quantity').order('name')]);const dishes=(data||[]).map(d=>({...d,category:d.category||categoryFor(d.name)}));return <main className="shell"><Nav name={ctx.profile.full_name} role={ctx.profile.role}/><div className="hero"><div><div className="eyebrow">LA CUCINA È APERTA · КУХНЯ ОТКРЫТА</div><h1 className="pageTitle">Что приготовим <em>сегодня?</em></h1><p className="sub">Любимые блюда, немного Италии и много хорошего вкуса.</p></div><div className="heroStamp">Fatto<br/><i>con amore</i><span>СДЕЛАНО С ЛЮБОВЬЮ</span></div></div><MenuClient dishes={dishes as any} worker={ctx.profile.full_name} inventory={(inventory||[]) as any}/></main>}
