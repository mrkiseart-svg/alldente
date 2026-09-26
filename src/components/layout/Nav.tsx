'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Moon,Sun,UtensilsCrossed,ReceiptText,ChartPie,Carrot,BookOpen,LogOut,UsersRound,Boxes} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import type {AppRole} from '@/lib/auth';

const roleLabel:Record<AppRole,string>={worker:'Работник',manager:'Менеджер',creator:'Создатель'};

export default function Nav({name,role='worker'}:{name?:string;role?:AppRole}){
  const p=usePathname();
  const[dark,setDark]=useState(false);
  useEffect(()=>{const value=localStorage.getItem('aldente-theme')==='dark';setDark(value);document.documentElement.classList.toggle('dark',value)},[]);
  const links=[
    ['/menu','Новый заказ',UtensilsCrossed,true],
    ['/orders',role==='worker'?'Мои чеки':'Чеки',ReceiptText,true],
    ['/reports','Отчётность',ChartPie,true],
    ['/warehouse','Склад',Boxes,true],
    ['/ingredients','Ингредиенты',Carrot,role!=='worker'],
    ['/dishes','Блюда и цены',BookOpen,role!=='worker'],
    ['/users','Пользователи',UsersRound,role==='creator'],
  ] as const;
  return <header className="topbar"><Link href="/menu" className="brand"><span className="brandMark"><UtensilsCrossed size={25}/></span><span>Al’Dente<small>TRATTORIA • CUCINA ITALIANA</small></span></Link><nav className="nav" aria-label="Основная навигация">{links.filter(([, , ,show])=>show).map(([href,label,Icon])=><Link href={href} key={href} className={p.startsWith(href)?'active':''} aria-current={p.startsWith(href)?'page':undefined}><Icon size={17}/>{label}</Link>)}</nav><div className="navRight">{name&&<span className="roleBadge" title={`Роль: ${roleLabel[role]}`}>{roleLabel[role]}</span>}{name&&<span className="avatar" title={name}>{name.slice(0,1)}</span>}<button className="themeToggle" aria-label="Переключить тему" onClick={()=>{setDark(!dark);document.documentElement.classList.toggle('dark',!dark);localStorage.setItem('aldente-theme',!dark?'dark':'light')}}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="themeToggle" aria-label="Выйти" onClick={async()=>{await createClient().auth.signOut();window.location.href='/login'}}><LogOut size={17}/></button></div></header>
}
