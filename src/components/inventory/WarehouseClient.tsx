'use client';
import {useMemo,useState} from 'react';
import {Boxes,Check,PackageOpen,Save,Search,ShieldCheck,TriangleAlert} from 'lucide-react';
import type {AppRole,StockIngredient} from '@/types';

type Row=StockIngredient&{draft:string};
const canEdit=(role:AppRole)=>role==='manager'||role==='creator';
const q=(n:number)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:3});
const parseQty=(value:string)=>Number(value.replace(',','.'));

export default function WarehouseClient({ingredients,role}:{ingredients:StockIngredient[];role:AppRole}){
  const [rows,setRows]=useState<Row[]>(()=>ingredients.map(i=>({...i,draft:String(Number(i.stock_quantity))})));
  const [search,setSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const editable=canEdit(role);
  const filtered=useMemo(()=>rows.filter(r=>r.name.toLowerCase().includes(search.trim().toLowerCase())),[rows,search]);
  const dirtyRows=useMemo(()=>rows.filter(r=>{const value=parseQty(r.draft);return Number.isFinite(value)&&value>=0&&Math.round(value*1000)/1000!==Number(r.stock_quantity)}),[rows]);
  const hasInvalid=useMemo(()=>rows.some(r=>{const value=parseQty(r.draft);return !Number.isFinite(value)||value<0||value>99999999999}),[rows]);
  const preview=(row:Row)=>{const value=parseQty(row.draft);return Number.isFinite(value)&&value>=0?value:Number(row.stock_quantity)};
  const empty=rows.filter(r=>preview(r)<=0).length;
  const low=rows.filter(r=>preview(r)>0&&preview(r)<=5).length;
  const updateDraft=(id:string,value:string)=>{setRows(x=>x.map(r=>r.id===id?{...r,draft:value}:r));setMessage('');setError('')};

  async function saveAll(){
    if(!editable||busy||!dirtyRows.length)return;
    if(hasInvalid){setError('Проверьте остатки: допустимы только числа от 0.');return}
    setBusy(true);setMessage('');setError('');
    try{
      const items=dirtyRows.map(r=>({id:r.id,stock_quantity:Math.round(parseQty(r.draft)*1000)/1000}));
      const res=await fetch('/api/inventory',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({items})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Не удалось сохранить склад');
      const changed=new Map(items.map(i=>[i.id,i.stock_quantity]));
      setRows(current=>current.map(r=>changed.has(r.id)?{...r,stock_quantity:changed.get(r.id)!,draft:String(changed.get(r.id)!)}:r));
      setMessage(`Сохранено изменений: ${items.length}`);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить склад')}finally{setBusy(false)}
  }

  return <>
    <div className="warehouseStats">
      <div className="panel warehouseStat"><Boxes/><span>Позиций</span><strong>{rows.length}</strong></div>
      <div className="panel warehouseStat"><TriangleAlert/><span>Заканчиваются</span><strong>{low}</strong></div>
      <div className="panel warehouseStat"><PackageOpen/><span>Нет в наличии</span><strong>{empty}</strong></div>
    </div>
    <div className="toolbar warehouseToolbar">
      <label className="searchBox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти ингредиент…"/></label>
      <div className="warehouseToolbarRight">
        <div className="warehouseAccess"><ShieldCheck size={17}/>{editable?'Вы можете изменять остатки':'Просмотр склада'}</div>
        {editable&&<button className="primary warehouseSaveAll" disabled={busy||!dirtyRows.length||hasInvalid} onClick={saveAll}><Save size={17}/>{busy?'СОХРАНЯЕМ…':dirtyRows.length?`СОХРАНИТЬ · ${dirtyRows.length}`:'СОХРАНИТЬ'}</button>}
      </div>
    </div>
    {editable&&(message||error)&&<div className={error?'warehouseFeedback error':'warehouseFeedback success'}>{error||<><Check size={15}/>{message}</>}</div>}
    <div className="panel tableWrap warehouseTable"><table className="table"><thead><tr><th>Ингредиент</th><th>Остаток</th><th>Ед.</th><th>Состояние</th>{editable&&<th>Новый остаток</th>}</tr></thead><tbody>{filtered.map(row=>{const value=preview(row);const state=value<=0?'Нет в наличии':value<=5?'Заканчивается':'В наличии';const changed=Math.round(value*1000)/1000!==Number(row.stock_quantity);return <tr key={row.id} className={changed?'stockChanged':''}><td><b>{row.name}</b></td><td><strong className="stockNumber">{q(value)}</strong></td><td>{row.unit||'шт'}</td><td><span className={'stockState '+(value<=0?'empty':value<=5?'low':'ok')}>{state}</span></td>{editable&&<td><div className="stockEdit"><input inputMode="decimal" min="0" step="0.001" value={row.draft} onChange={e=>updateDraft(row.id,e.target.value)} aria-label={`Остаток ${row.name}`}/>{changed&&<small className="stockUnsaved">не сохранено</small>}</div></td>}</tr>})}</tbody></table>{!filtered.length&&<div className="emptyState"><PackageOpen size={38}/><h2>Ничего не найдено</h2><p>Попробуйте другое название ингредиента.</p></div>}</div>
  </>
}
