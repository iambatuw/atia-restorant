import {useState} from 'react';
import {money} from './api';
import type {OptionGroup,Product} from './types';

/** Client-side mirror of the server rule: required groups need a choice, single groups allow one. */
export function optionProblem(groups:OptionGroup[],selected:number[]):string|null{
  for(const group of groups){
    const count=group.Secenekler.filter(o=>selected.includes(o.KayitNo)).length;
    if(group.Zorunlu&&count===0) return `“${group.Ad}” seçimi zorunlu.`;
    if(!group.CokluSecim&&count>1) return `“${group.Ad}” için tek seçenek seçin.`;
  }
  return null;
}

export function toggleOption(groups:OptionGroup[],selected:number[],id:number):number[]{
  const group=groups.find(g=>g.Secenekler.some(o=>o.KayitNo===id));
  if(!group) return selected;
  if(selected.includes(id)) return selected.filter(x=>x!==id);
  // A single-choice group swaps its current choice.
  const others=group.CokluSecim?selected:selected.filter(x=>!group.Secenekler.some(o=>o.KayitNo===x));
  return [...others,id];
}

export function OptionChooser({product,basePrice,onCancel,onConfirm,disabled=false}:{product:Product;basePrice:number;onCancel:()=>void;onConfirm:(ids:number[])=>void;disabled?:boolean}){
  const groups=product.SecenekGruplari??[];
  const [selected,setSelected]=useState<number[]>([]);
  const problem=optionProblem(groups,selected);
  const extra=groups.flatMap(g=>g.Secenekler).filter(o=>selected.includes(o.KayitNo)).reduce((sum,o)=>sum+o.EkFiyat,0);
  return <section className="op-option-panel" aria-label={`${product.StokAdi} seçenekleri`}>
    <header><strong>{product.StokAdi}</strong><span>Birim fiyat {money(basePrice+extra)}</span></header>
    {groups.map(group=><div className="op-option-group" key={group.KayitNo} role="group" aria-label={group.Ad}>
      <strong>{group.Ad}<small>{group.Zorunlu?'Zorunlu':'İsteğe bağlı'} · {group.CokluSecim?'birden fazla seçilebilir':'tek seçim'}</small></strong>
      <div className="op-chip-row">{group.Secenekler.map(option=><button type="button" key={option.KayitNo} className="op-chip"
        aria-pressed={selected.includes(option.KayitNo)} onClick={()=>setSelected(s=>toggleOption(groups,s,option.KayitNo))}>
        {option.Ad}{option.EkFiyat>0&&<small>+{money(option.EkFiyat)}</small>}</button>)}</div>
    </div>)}
    <footer>{problem&&<span className="error-text" role="status">{problem}</span>}
      <button type="button" className="secondary" onClick={onCancel}>Vazgeç</button>
      <button type="button" className="primary" disabled={!!problem||disabled} onClick={()=>onConfirm(selected)}>Seçimi ekle</button></footer>
  </section>;
}
