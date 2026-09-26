'use client';
import {useState} from 'react';
import {ShieldCheck,UserRoundCog} from 'lucide-react';
import type {AppRole} from '@/lib/auth';

type UserRow={id:string;login:string;full_name:string;role:AppRole;created_at?:string|null};
const labels:Record<AppRole,string>={worker:'Работник',manager:'Менеджер',creator:'Создатель'};
export default function RoleManager({users,currentUserId}:{users:UserRow[];currentUserId:string}){
  const[rows,setRows]=useState(users),[busy,setBusy]=useState<string[]>([]),[status,setStatus]=useState<Record<string,string>>({});
  async function changeRole(id:string,role:AppRole){
    const prev=rows.find(x=>x.id===id)?.role;if(!prev||prev===role)return;
    setBusy(x=>[...x,id]);setStatus(s=>({...s,[id]:''}));
    try{const res=await fetch('/api/admin/users',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,role})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Не удалось изменить роль');setRows(rs=>rs.map(r=>r.id===id?{...r,role}:r));setStatus(s=>({...s,[id]:'Сохранено'}))}catch(e){setStatus(s=>({...s,[id]:e instanceof Error?e.message:'Ошибка'}))}finally{setBusy(x=>x.filter(v=>v!==id))}
  }
  return <div className="panel tableWrap"><table className="table"><thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Статус</th></tr></thead><tbody>{rows.map(u=><tr key={u.id}><td><b>{u.full_name}</b>{u.id===currentUserId&&<span className="youBadge">Вы</span>}</td><td>{u.login}</td><td><label className="roleSelect"><UserRoundCog size={15}/><select value={u.role} disabled={busy.includes(u.id)} onChange={e=>changeRole(u.id,e.target.value as AppRole)}><option value="worker">{labels.worker}</option><option value="manager">{labels.manager}</option><option value="creator">{labels.creator}</option></select></label></td><td><span className={'status '+(status[u.id]==='Сохранено'?'success':'')}>{status[u.id]||<><ShieldCheck size={13}/> {labels[u.role]}</>}</span></td></tr>)}</tbody></table></div>
}
