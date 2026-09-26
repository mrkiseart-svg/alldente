import {createClient} from '@/lib/supabase/server';

export type AppRole='worker'|'manager'|'creator';
export type SessionProfile={id:string;login:string;full_name:string;role:AppRole};

export function normalizeRole(role?:string|null):AppRole{
  if(role==='creator'||role==='manager'||role==='worker')return role;
  if(role==='admin')return 'manager';
  return 'worker';
}

export function canManagePrices(role:AppRole){return role==='manager'||role==='creator'}
export function canSeeAllReports(role:AppRole){return role==='manager'||role==='creator'}
export function canManageUsers(role:AppRole){return role==='creator'}
export function canManageWarehouse(role:AppRole){return role==='manager'||role==='creator'}

export async function getSessionContext(){
  const sb=await createClient();
  const{data:{user}}=await sb.auth.getUser();
  if(!user)return null;
  const{data:profile}=await sb.from('profiles').select('id,login,full_name,role').eq('id',user.id).maybeSingle();
  const fallbackName=user.user_metadata?.full_name||user.user_metadata?.login||user.email?.split('@')[0]||'Сотрудник';
  const fallbackLogin=user.user_metadata?.login||user.email?.split('@')[0]||'worker';
  return {sb,user,profile:{id:user.id,login:profile?.login||fallbackLogin,full_name:profile?.full_name||fallbackName,role:normalizeRole(profile?.role)} as SessionProfile};
}
