import {redirect} from 'next/navigation';
import PriceEditor from '@/components/PriceEditor';
import {canManagePrices,getSessionContext} from '@/lib/auth';
export default async function Page(){const ctx=await getSessionContext();if(!ctx)redirect('/login');if(!canManagePrices(ctx.profile.role))redirect('/menu');return <PriceEditor kind="ingredients" name={ctx.profile.full_name} role={ctx.profile.role}/>}
