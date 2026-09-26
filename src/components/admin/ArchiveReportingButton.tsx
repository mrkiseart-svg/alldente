'use client';
import {useState} from 'react';
import {Archive,Check,TriangleAlert,X} from 'lucide-react';
import {useRouter} from 'next/navigation';

export default function ArchiveReportingButton(){
  const [open,setOpen]=useState(false);
  const [period,setPeriod]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const router=useRouter();

  async function archive(){
    const value=period.trim();
    if(value.length<2){setError('Введите название периода.');return}
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/admin/archive',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({period:value})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Не удалось архивировать период');
      setOpen(false);setPeriod('');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось архивировать период')}finally{setBusy(false)}
  }

  return <>
    <button className="pill archiveButton" onClick={()=>{setOpen(true);setError('')}}><Archive size={14}/>АРХИВИРОВАТЬ</button>
    {open&&<div className="modalBackdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
      <section className="panel archiveModal" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <button className="modalClose" aria-label="Закрыть" disabled={busy} onClick={()=>setOpen(false)}><X size={18}/></button>
        <div className="archiveModalIcon"><Archive size={23}/></div>
        <h2 id="archive-title">Архивировать отчётность</h2>
        <p className="sub">Укажите название периода. Текущие чеки будут удалены из активной отчётности, а выручка и прибыль сохранятся в архиве.</p>
        <label className="archiveField">Период<input autoFocus value={period} maxLength={120} onChange={e=>setPeriod(e.target.value)} placeholder="Например: Сентябрь 2026" onKeyDown={e=>{if(e.key==='Enter'&&!busy)archive()}}/></label>
        <div className="archiveWarning"><TriangleAlert size={17}/><span>После архивации текущие чеки нельзя будет открыть по отдельности.</span></div>
        {error&&<p className="error" role="alert">{error}</p>}
        <div className="modalActions"><button className="pill" disabled={busy} onClick={()=>setOpen(false)}>Отмена</button><button className="primary archiveConfirm" disabled={busy||period.trim().length<2} onClick={archive}>{busy?'Архивируем…':<><Check size={17}/>Архивировать</>}</button></div>
      </section>
    </div>}
  </>
}
