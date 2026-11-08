import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {api,toCents} from './api';
import type {Category,Product} from './types';
import {ErrorBox,Modal} from './ui';

export function CategoryEditor({categories,category,close}:{categories:Category[];category?:Category;close:()=>void}){
  const client=useQueryClient();
  const [name,setName]=useState(category?.GrupAdi??'');
  const save=useMutation({mutationFn:()=>api(`/menu/kategoriler${category?`/${category.KayitNo}`:''}`,{
    method:category?'PUT':'POST',body:JSON.stringify({GrupAdi:name.trim()})
  }),onSuccess:async()=>{await client.invalidateQueries({queryKey:['menu']});close();}});
  const duplicate=categories.some(item=>item.KayitNo!==category?.KayitNo&&item.GrupAdi.toLocaleLowerCase('tr')===name.trim().toLocaleLowerCase('tr'));
  return <Modal title={category?'Kategoriyi düzenle':'Yeni kategori'} onClose={close}><form className="craft-form" onSubmit={event=>{event.preventDefault();save.mutate();}}>
    <label>Kategori adı<input autoFocus required maxLength={80} value={name} onChange={event=>setName(event.target.value)}/></label>
    {duplicate&&<p role="alert">Bu kategori adı zaten var.</p>}<ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={save.isPending||!name.trim()||duplicate}>{save.isPending?'Kaydediliyor…':'Kaydet'}</button></div>
  </form></Modal>;
}

export function ProductEditor({categories,product,close}:{categories:Category[];product?:Product;close:()=>void}){
  const client=useQueryClient();
  const [categoryId,setCategoryId]=useState(String(product?.GrupKayitNo??categories[0]?.KayitNo??''));
  const [name,setName]=useState(product?.StokAdi??'');
  const [price,setPrice]=useState(product?String(product.SatisFiyati):'');
  const [active,setActive]=useState(product?.Aktif??true);
  const [portions,setPortions]=useState((product?.Porsiyonlar??[]).map(item=>({name:item.PorsiyonAdi,price:String(item.Fiyat)})));
  const valid=!!categoryId&&!!name.trim()&&toCents(price)!==null&&portions.length<=10&&portions.every(item=>item.name.trim()&&toCents(item.price)!==null);
  const save=useMutation({mutationFn:()=>api(`/menu/urunler${product?`/${product.KayitNo}`:''}`,{
    method:product?'PUT':'POST',body:JSON.stringify({GrupKayitNo:Number(categoryId),StokAdi:name.trim(),SatisFiyati:toCents(price)!/100,Aktif:active,
      Porsiyonlar:portions.map(item=>({PorsiyonAdi:item.name.trim(),Fiyat:toCents(item.price)!/100}))})
  }),onSuccess:async()=>{await client.invalidateQueries({queryKey:['menu']});close();}});
  return <Modal title={product?`${product.StokAdi} düzenle`:'Yeni ürün'} onClose={close}><form className="craft-form" onSubmit={event=>{event.preventDefault();if(valid)save.mutate();}}>
    <div className="form-row"><label>Kategori<select required value={categoryId} onChange={event=>setCategoryId(event.target.value)}>{categories.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.GrupAdi}</option>)}</select></label><label>Satış fiyatı<input required inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="0,00"/></label></div>
    <label>Ürün adı<input autoFocus required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
    <label className="op-check-label"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/> Satışta</label>
    <div className="op-editor-heading"><strong>Porsiyonlar</strong><button type="button" className="secondary" disabled={portions.length>=10} onClick={()=>setPortions(items=>[...items,{name:'',price:''}])}>Porsiyon ekle</button></div>
    {portions.map((item,index)=><div className="form-row op-portion-row" key={index}><label>Ad<input maxLength={60} value={item.name} onChange={event=>setPortions(items=>items.map((row,i)=>i===index?{...row,name:event.target.value}:row))}/></label><label>Fiyat<input inputMode="decimal" value={item.price} onChange={event=>setPortions(items=>items.map((row,i)=>i===index?{...row,price:event.target.value}:row))}/></label><button type="button" onClick={()=>setPortions(items=>items.filter((_,i)=>i!==index))} aria-label={`${item.name||'Porsiyon'} kaldır`}>Kaldır</button></div>)}
    <ErrorBox error={save.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={save.isPending||!valid}>{save.isPending?'Kaydediliyor…':'Ürünü kaydet'}</button></div>
  </form></Modal>;
}
