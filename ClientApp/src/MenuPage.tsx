import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Plus,Search,X} from 'lucide-react';
import {api,money} from './api';
import type {Category,Product} from './types';
import {Empty,ErrorBox,Loading} from './ui';

export function MenuPage({onAdd,publicView=false,busy=false}:{onAdd?:(p:Product)=>void;publicView?:boolean;busy?:boolean}){
  const menu=useQuery({queryKey:['menu'],queryFn:()=>api<Category[]>('/menu')});
  const [category,setCategory]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const categories=menu.data??[];
  const query=search.toLocaleLowerCase('tr').trim();
  const products=categories.filter(c=>category===null||c.KayitNo===category).flatMap(c=>c.Urunler).filter(p=>p.Aktif&&p.StokAdi.toLocaleLowerCase('tr').includes(query));
  const title=onAdd?'Ürün seçin':'Menü';

  return <section className={`new-menu ${publicView?'new-menu-public':''} ${onAdd?'new-menu-picker':''}`} aria-label="Ürün menüsü">
    {!onAdd&&<header className="new-menu-head"><div><h1>{title}</h1><p>{publicView?'Güncel ürünleri ve fiyatları inceleyin.':'Satışa açık ürünler ve güncel fiyatları'}</p></div><span>{products.length} ürün</span></header>}
    <div className="new-menu-tools"><label className="new-menu-search"><Search size={18}/><input type="search" aria-label="Menüde ürün ara" placeholder="Ürün ara" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Aramayı temizle" onClick={()=>setSearch('')}><X size={16}/></button>}</label>
      <div className="new-menu-categories" role="group" aria-label="Kategoriler"><button aria-pressed={category===null} onClick={()=>setCategory(null)}>Tümü</button>{categories.map(c=><button key={c.KayitNo} aria-pressed={category===c.KayitNo} onClick={()=>setCategory(c.KayitNo)}>{c.GrupAdi}</button>)}</div>
    </div>
    <ErrorBox error={menu.error} retry={()=>void menu.refetch()}/>
    {menu.isPending?<Loading/>:products.length===0?<Empty>Bu aramada ürün bulunamadı.</Empty>:<div className="new-menu-list">{products.map(p=><article key={p.KayitNo}><div><span>{p.GrupAdi}</span><h2>{p.StokAdi}</h2>{p.Porsiyonlar.length>0&&<small>{p.Porsiyonlar.map(portion=>portion.PorsiyonAdi).join(', ')}</small>}</div><strong>{money(p.SatisFiyati)}</strong>{onAdd&&<button className="secondary" type="button" disabled={busy} onClick={()=>onAdd(p)} aria-label={`${p.StokAdi} adisyona ekle`}><Plus size={16}/> Ekle</button>}</article>)}</div>}
    {publicView&&<p className="new-menu-note">Alerjen ve içerik bilgisi için servis ekibine danışın.</p>}
  </section>;
}
