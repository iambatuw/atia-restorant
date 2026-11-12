import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api,toCents} from './api';
import type {Category,FullSettings,OptionGroup,Product} from './types';
import {ErrorBox,Modal} from './ui';

type OptionDraft={name:string;required:boolean;multi:boolean;options:{name:string;price:string}[]};

function OptionGroupEditor({group,change,remove}:{group:OptionDraft;change:(group:OptionDraft)=>void;remove:()=>void}){
  return <div className="op-option-editor">
    <div className="op-option-editor-head"><label>Grup adı<input maxLength={40} value={group.name} onChange={event=>change({...group,name:event.target.value})} placeholder="ör. Pişirme, Ekstralar"/></label>
      <button type="button" onClick={remove} aria-label={`${group.name||'Grup'} kaldır`}>Grubu kaldır</button></div>
    <div className="op-inline-checks"><label><input type="checkbox" checked={group.required} onChange={event=>change({...group,required:event.target.checked})}/> Seçim zorunlu</label>
      <label><input type="checkbox" checked={group.multi} onChange={event=>change({...group,multi:event.target.checked})}/> Birden fazla seçilebilir</label></div>
    {group.options.map((option,index)=><div className="form-row op-portion-row" key={index}>
      <label>Seçenek<input maxLength={40} value={option.name} onChange={event=>change({...group,options:group.options.map((row,i)=>i===index?{...row,name:event.target.value}:row)})}/></label>
      <label>Ek fiyat<input inputMode="decimal" value={option.price} onChange={event=>change({...group,options:group.options.map((row,i)=>i===index?{...row,price:event.target.value}:row)})}/></label>
      <button type="button" disabled={group.options.length<=1} onClick={()=>change({...group,options:group.options.filter((_,i)=>i!==index)})} aria-label={`${option.name||'Seçenek'} kaldır`}>Kaldır</button></div>)}
    <button type="button" className="secondary" disabled={group.options.length>=20} onClick={()=>change({...group,options:[...group.options,{name:'',price:'0'}]})}>Seçenek ekle</button>
  </div>;
}

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
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const [categoryId,setCategoryId]=useState(String(product?.GrupKayitNo??categories[0]?.KayitNo??''));
  const [name,setName]=useState(product?.StokAdi??'');
  const [price,setPrice]=useState(product?String(product.SatisFiyati):'');
  const [active,setActive]=useState(product?.Aktif??true);
  const [portions,setPortions]=useState((product?.Porsiyonlar??[]).map(item=>({name:item.PorsiyonAdi,price:String(item.Fiyat),factor:String(item.Carpan??1)})));
  const [vat,setVat]=useState(String(product?.KdvOrani??10));
  const [barcode,setBarcode]=useState(product?.Barkod??'');
  const [quickNotes,setQuickNotes]=useState<string[]>(product?.HazirNotlar??[]);
  const [groups,setGroups]=useState<OptionDraft[]>((product?.SecenekGruplari??[]).map(group=>({name:group.Ad,required:group.Zorunlu,multi:group.CokluSecim,
    options:group.Secenekler.map(option=>({name:option.Ad,price:String(option.EkFiyat)}))})));
  const factorValid=(value:string)=>/^\d+(?:[.,]\d{1,3})?$/.test(value)&&Number(value.replace(',','.'))>0&&Number(value.replace(',','.'))<=10;
  const groupsValid=groups.every(group=>group.name.trim()&&group.options.length>0&&group.options.every(option=>option.name.trim()&&toCents(option.price)!==null));
  const valid=!!categoryId&&!!name.trim()&&toCents(price)!==null&&portions.length<=10&&portions.every(item=>item.name.trim()&&toCents(item.price)!==null&&factorValid(item.factor))&&groupsValid&&/^[A-Za-z0-9.-]{0,32}$/.test(barcode.trim());
  const save=useMutation({mutationFn:()=>api(`/menu/urunler${product?`/${product.KayitNo}`:''}`,{
    method:product?'PUT':'POST',body:JSON.stringify({GrupKayitNo:Number(categoryId),StokAdi:name.trim(),SatisFiyati:toCents(price)!/100,Aktif:active,
      KdvOrani:Number(vat),Barkod:barcode.trim()||null,
      HazirNotlar:quickNotes,
      Porsiyonlar:portions.map(item=>({PorsiyonAdi:item.name.trim(),Fiyat:toCents(item.price)!/100,Carpan:Number(item.factor.replace(',','.'))})),
      SecenekGruplari:groups.map(group=>({Ad:group.name.trim(),Zorunlu:group.required,CokluSecim:group.multi,
        Secenekler:group.options.map(option=>({Ad:option.name.trim(),EkFiyat:toCents(option.price)!/100}))}) as Partial<OptionGroup>)})
  }),onSuccess:async()=>{await client.invalidateQueries({queryKey:['menu']});close();}});
  return <Modal title={product?`${product.StokAdi} düzenle`:'Yeni ürün'} onClose={close}><form className="craft-form" onSubmit={event=>{event.preventDefault();if(valid)save.mutate();}}>
    <div className="form-row"><label>Kategori<select required value={categoryId} onChange={event=>setCategoryId(event.target.value)}>{categories.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.GrupAdi}</option>)}</select></label><label>Satış fiyatı<input required inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="0,00"/></label></div>
    <label>Ürün adı<input autoFocus required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
    <div className="form-row"><label>KDV oranı<select value={vat} onChange={event=>setVat(event.target.value)}>{[0,1,10,20].map(rate=><option key={rate} value={rate}>%{rate}</option>)}</select></label>
      <label>Barkod (isteğe bağlı)<input maxLength={32} value={barcode} onChange={event=>setBarcode(event.target.value)} placeholder="Okutun veya yazın"/></label></div>
    <label className="op-check-label"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/> Satışta</label>
    <div className="op-editor-heading"><strong>Bu üründe gösterilecek hazır notlar</strong></div>
    <p className="op-note">Yalnızca seçilen notlar bu ürünün sipariş ekranında görünür.</p>
    <ErrorBox error={settings.error} retry={()=>void settings.refetch()}/>
    <div className="op-inline-checks op-quick-note-options">{(settings.data?.HazirNotlar??[]).map(item=><label key={item}><input type="checkbox"
      checked={quickNotes.some(note=>note.toLocaleLowerCase('tr')===item.toLocaleLowerCase('tr'))}
      onChange={event=>setQuickNotes(notes=>event.target.checked?[...notes,item]:notes.filter(note=>note.toLocaleLowerCase('tr')!==item.toLocaleLowerCase('tr')))}/>{item}</label>)}</div>
    <div className="op-editor-heading"><strong>Porsiyonlar</strong><button type="button" className="secondary" disabled={portions.length>=10} onClick={()=>setPortions(items=>[...items,{name:'',price:'',factor:'1'}])}>Porsiyon ekle</button></div>
    {portions.map((item,index)=><div className="form-row op-portion-row" key={index}><label>Ad<input maxLength={60} value={item.name} onChange={event=>setPortions(items=>items.map((row,i)=>i===index?{...row,name:event.target.value}:row))}/></label><label>Fiyat<input inputMode="decimal" value={item.price} onChange={event=>setPortions(items=>items.map((row,i)=>i===index?{...row,price:event.target.value}:row))}/></label><label>Reçete çarpanı<input inputMode="decimal" value={item.factor} onChange={event=>setPortions(items=>items.map((row,i)=>i===index?{...row,factor:event.target.value}:row))}/></label><button type="button" onClick={()=>setPortions(items=>items.filter((_,i)=>i!==index))} aria-label={`${item.name||'Porsiyon'} kaldır`}>Kaldır</button></div>)}
    <div className="op-editor-heading"><strong>Seçenekler ve ekstralar</strong><button type="button" className="secondary" disabled={groups.length>=8} onClick={()=>setGroups(items=>[...items,{name:'',required:false,multi:false,options:[{name:'',price:'0'}]}])}>Grup ekle</button></div>
    {groups.length===0&&<p className="op-note">Pişirme derecesi, ekstra malzeme veya menü içeriği seçimi (ör. içecek seçimi) için grup ekleyin.</p>}
    {groups.map((group,index)=><OptionGroupEditor key={index} group={group} change={next=>setGroups(items=>items.map((row,i)=>i===index?next:row))} remove={()=>setGroups(items=>items.filter((_,i)=>i!==index))}/>)}
    <ErrorBox error={save.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={save.isPending||!valid}>{save.isPending?'Kaydediliyor…':'Ürünü kaydet'}</button></div>
  </form></Modal>;
}
