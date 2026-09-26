import {redirect} from 'next/navigation';
import Nav from '@/components/layout/Nav';
import MenuClient from '@/components/menu/MenuClient';
import {getSessionContext} from '@/lib/auth';
import {categoryFor} from '@/lib/categories';

export default async function Menu(){
  const ctx=await getSessionContext();
  if(!ctx)redirect('/login');

  const [dishResult,inventoryResult]=await Promise.all([
    ctx.sb.from('dishes').select('*').eq('active',true).order('name'),
    ctx.sb.from('ingredients').select('name,unit,stock_quantity').order('name'),
  ]);

  const dishes=(dishResult.data||[]).map(d=>({...d,category:d.category||categoryFor(d.name)}));
  const loadError=dishResult.error
    ?`Не удалось загрузить блюда: ${dishResult.error.message}`
    :inventoryResult.error
      ?`Блюда загружены, но склад недоступен: ${inventoryResult.error.message}`
      :'';

  return <main className="shell">
    <Nav name={ctx.profile.full_name} role={ctx.profile.role}/>
    <div className="hero"><div><div className="eyebrow">LA CUCINA È APERTA · КУХНЯ ОТКРЫТА</div><h1 className="pageTitle">Что приготовим <em>сегодня?</em></h1><p className="sub">Любимые блюда, немного Италии и много хорошего вкуса.</p></div><div className="heroStamp">Fatto<br/><i>con amore</i><span>СДЕЛАНО С ЛЮБОВЬЮ</span></div></div>
    {loadError&&<p className="error" role="alert">{loadError}</p>}
    <MenuClient dishes={dishes as any} worker={ctx.profile.full_name} inventory={(inventoryResult.data||[]) as any}/>
  </main>;
}
