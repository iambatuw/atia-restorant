import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowDownUp,Boxes,Pencil,Plus,Trash2} from 'lucide-react';
import {api,money} from './api';
import type {Category,Ingredient,ProductCost,RecipeRow,StockMovement,StockMovementType} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import './Extensions.css';

const units=['kg','g','lt','ml','adet','porsiyon'];
const movementNames:Record<StockMovementType,string>={0:'Giriş',1:'Çıkış',2:'Sayım',3:'Satış',4:'Satış iadesi'};
const qty=(value:number)=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:3}).format(value);
const parseQty=(value:string)=>/^\d+(?:[.,]\d{1,3})?$/.test(value.trim())?Number(value.trim().replace(',','.')):null;
const parseCost=(value:string)=>/^\d+(?:[.,]\d{1,4})?$/.test(value.trim())?Number(value.trim().replace(',','.')):null;

export default function StockPage(){
  const [tab,setTab]=useState<'items'|'recipes'|'costs'|'moves'>('items');
  const ingredients=useQuery({queryKey:['ingredients'],queryFn:()=>api<Ingredient[]>('/stok/hammaddeler')});
  const critical=(ingredients.data??[]).filter(i=>i.Kritik);
  return <section className="op-page" aria-label="Stok ve maliyet">
    <header className="op-page-head"><div><h1>Stok ve maliyet</h1><p>Hammaddeler, reçeteler ve ürün maliyetleri. Satış reçeteye göre stoktan düşer; iptal geri ekler, zayi eklemez.</p></div>
      <div className="op-head-count"><strong>{ingredients.data?.length??0}</strong><span>hammadde</span><strong>{critical.length}</strong><span>kritik</span></div></header>
    <div className="op-tabs" role="group" aria-label="Stok bölümleri">
      {([['items','Hammaddeler'],['recipes','Reçeteler'],['costs','Maliyet'],['moves','Hareketler']] as const).map(([id,label])=>
        <button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}{id==='items'&&critical.length>0&&<span>· {critical.length} kritik</span>}</button>)}
    </div>
    <ErrorBox error={ingredients.error} retry={()=>void ingredients.refetch()}/>
    {ingredients.isPending?<Loading/>:tab==='items'?<Ingredients list={ingredients.data??[]}/>:tab==='recipes'?<Recipes ingredients={ingredients.data??[]}/>:tab==='costs'?<Costs/>:<Movements ingredients={ingredients.data??[]}/>}
  </section>;
}

function Ingredients({list}:{list:Ingredient[]}){
  const [edit,setEdit]=useState<Ingredient|true|null>(null);
  const [move,setMove]=useState<Ingredient|null>(null);
  return <>
    <div className="op-toolbar-row"><button className="primary" onClick={()=>setEdit(true)}><Plus size={16}/> Hammadde ekle</button></div>
    {list.length===0?<Empty><Boxes size={28}/><h2>Hammadde yok</h2></Empty>:<section className="op-panel"><div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Hammadde</th><th className="num">Stok</th><th className="num">Kritik seviye</th><th className="num">Birim maliyet</th><th className="num">Stok değeri</th><th></th></tr></thead>
      <tbody>{list.map(item=><tr key={item.KayitNo}>
        <td><strong>{item.Ad}</strong>{!item.Aktif&&<small>Pasif</small>}</td>
        <td className="num">{qty(item.Stok)} {item.Birim} {item.Kritik&&<span className={`op-badge ${item.Stok<0?'is-danger':'is-warning'}`}>{item.Stok<0?'Eksi stok':'Kritik'}</span>}</td>
        <td className="num">{qty(item.KritikSeviye)} {item.Birim}</td>
        <td className="num">{money(item.BirimMaliyet)} / {item.Birim}</td>
        <td className="num">{money(Math.max(0,item.Stok)*item.BirimMaliyet)}</td>
        <td className="num"><button className="secondary" onClick={()=>setMove(item)} aria-label={`${item.Ad} stok hareketi`}><ArrowDownUp size={15}/> Hareket</button> <button className="secondary" onClick={()=>setEdit(item)} aria-label={`${item.Ad} düzenle`}><Pencil size={15}/></button></td>
      </tr>)}</tbody></table></div></section>}
    {edit&&<IngredientEditor item={edit===true?undefined:edit} close={()=>setEdit(null)}/>}
    {move&&<MovementForm item={move} close={()=>setMove(null)}/>}
  </>;
}

function IngredientEditor({item,close}:{item?:Ingredient;close:()=>void}){
  const client=useQueryClient();
  const [name,setName]=useState(item?.Ad??'');
  const [unit,setUnit]=useState(item?.Birim??'kg');
  const [critical,setCritical]=useState(String(item?.KritikSeviye??0));
  const [cost,setCost]=useState(String(item?.BirimMaliyet??0));
  const [active,setActive]=useState(item?.Aktif??true);
  const valid=!!name.trim()&&parseQty(critical)!==null&&parseCost(cost)!==null;
  const save=useMutation({mutationFn:()=>api(item?`/stok/hammaddeler/${item.KayitNo}`:'/stok/hammaddeler',{method:item?'PUT':'POST',
    body:JSON.stringify({Ad:name.trim(),Birim:unit,KritikSeviye:parseQty(critical),BirimMaliyet:parseCost(cost),Aktif:active})}),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:['ingredients']});await client.invalidateQueries({queryKey:['costs']});close();}});
  return <Modal title={item?`${item.Ad} düzenle`:'Yeni hammadde'} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();if(valid)save.mutate();}}>
    <div className="form-row"><label>Ad<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Birim<select value={unit} onChange={e=>setUnit(e.target.value)} disabled={!!item&&item.Stok!==0}>{units.map(u=><option key={u}>{u}</option>)}</select></label></div>
    <div className="form-row"><label>Kritik seviye<input inputMode="decimal" value={critical} onChange={e=>setCritical(e.target.value)}/></label>
      <label>Birim maliyet (TL)<input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)}/></label></div>
    <label className="op-check-label"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Aktif</label>
    {!item&&<p className="op-note">Başlangıç stoğunu kaydettikten sonra “Hareket → Giriş” ile ekleyin.</p>}
    <ErrorBox error={save.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!valid||save.isPending}>{save.isPending?'Kaydediliyor…':'Kaydet'}</button></div>
  </form></Modal>;
}

function MovementForm({item,close}:{item:Ingredient;close:()=>void}){
  const client=useQueryClient();
  const [type,setType]=useState<0|1|2>(0);
  const [amount,setAmount]=useState('');
  const [cost,setCost]=useState('');
  const [note,setNote]=useState('');
  const quantity=parseQty(amount);
  const unitCost=cost.trim()?parseCost(cost):undefined;
  const valid=quantity!==null&&(type===2||quantity>0)&&unitCost!==null&&(type!==1||!!note.trim());
  const save=useMutation({mutationFn:()=>api('/stok/hareketler',{method:'POST',body:JSON.stringify({HammaddeKayitNo:item.KayitNo,Tip:type,Miktar:quantity,
    BirimMaliyet:type===0?unitCost:undefined,Aciklama:note.trim()||null})}),onSuccess:async()=>{await client.invalidateQueries();close();}});
  return <Modal title={`${item.Ad} · stok hareketi`} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();if(valid)save.mutate();}}>
    <p className="op-note">Mevcut stok: {qty(item.Stok)} {item.Birim}</p>
    <div className="op-removal-types" role="group" aria-label="Hareket türü">{([[0,'Giriş'],[1,'Çıkış'],[2,'Sayım']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={type===id} onClick={()=>setType(id)}>{label}</button>)}</div>
    <div className="form-row"><label>{type===2?`Sayılan miktar (${item.Birim})`:`Miktar (${item.Birim})`}<input autoFocus required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      {type===0&&<label>Alış birim maliyeti (isteğe bağlı)<input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} placeholder={String(item.BirimMaliyet)}/></label>}</div>
    <label>Açıklama{type===1?' (zorunlu)':''}<input maxLength={200} value={note} onChange={e=>setNote(e.target.value)} placeholder={type===1?'ör. bozulma, personel yemeği':'ör. fatura no'}/></label>
    {type===2&&quantity!==null&&<p className="op-note">Fark: {qty(quantity-item.Stok)} {item.Birim}</p>}
    <ErrorBox error={save.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!valid||save.isPending}>{save.isPending?'Kaydediliyor…':'Kaydet'}</button></div>
  </form></Modal>;
}

function Recipes({ingredients}:{ingredients:Ingredient[]}){
  const menu=useQuery({queryKey:['menu','yonetim'],queryFn:()=>api<Category[]>('/menu/yonetim')});
  const [productId,setProductId]=useState('');
  const products=(menu.data??[]).flatMap(c=>c.Urunler);
  const product=products.find(p=>String(p.KayitNo)===productId);
  return <>
    <ErrorBox error={menu.error} retry={()=>void menu.refetch()}/>
    <div className="op-toolbar-row"><label className="op-grow">Ürün<select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Ürün seçin</option>
      {products.map(p=><option key={p.KayitNo} value={p.KayitNo}>{p.StokAdi}{(p.Recete?.length??0)===0?' (reçete yok)':''}</option>)}</select></label></div>
    {product?<RecipeEditor key={product.KayitNo} productId={product.KayitNo} name={product.StokAdi} rows={product.Recete??[]} ingredients={ingredients}
      portions={product.Porsiyonlar}/>:<p className="op-note">Reçeteyi düzenlemek için bir ürün seçin. Miktarlar tam porsiyon için girilir; porsiyon çarpanı menü düzenleyicide tanımlanır.</p>}
  </>;
}

function RecipeEditor({productId,name,rows,ingredients,portions}:{productId:number;name:string;rows:RecipeRow[];ingredients:Ingredient[];portions:{PorsiyonAdi:string;Carpan?:number}[]}){
  const client=useQueryClient();
  const [draft,setDraft]=useState(rows.map(r=>({id:String(r.HammaddeKayitNo),amount:String(r.Miktar)})));
  const valid=draft.every(r=>r.id&&(parseQty(r.amount)??0)>0)&&new Set(draft.map(r=>r.id)).size===draft.length;
  const save=useMutation({mutationFn:()=>api(`/stok/receteler/${productId}`,{method:'PUT',body:JSON.stringify({Satirlar:draft.map(r=>({HammaddeKayitNo:Number(r.id),Miktar:parseQty(r.amount)}))})}),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:['menu']});await client.invalidateQueries({queryKey:['costs']});}});
  const cost=draft.reduce((sum,r)=>sum+(parseQty(r.amount)??0)*(ingredients.find(i=>String(i.KayitNo)===r.id)?.BirimMaliyet??0),0);
  return <section className="op-form-card"><h2>{name} reçetesi</h2>
    <p>Tam porsiyon maliyeti: <strong>{money(cost)}</strong>{portions.length>0&&` · ${portions.map(p=>`${p.PorsiyonAdi} ×${p.Carpan??1}`).join(', ')}`}</p>
    <div className="op-list-editor">{draft.map((row,index)=>{const unit=ingredients.find(i=>String(i.KayitNo)===row.id)?.Birim;return <div key={index}>
      <label>Hammadde<select value={row.id} onChange={e=>setDraft(d=>d.map((r,i)=>i===index?{...r,id:e.target.value}:r))}><option value="">Seçin</option>{ingredients.map(i=><option key={i.KayitNo} value={i.KayitNo}>{i.Ad} ({i.Birim})</option>)}</select></label>
      <label>Miktar{unit?` (${unit})`:''}<input inputMode="decimal" value={row.amount} onChange={e=>setDraft(d=>d.map((r,i)=>i===index?{...r,amount:e.target.value}:r))}/></label>
      <button type="button" className="secondary" aria-label="Satırı kaldır" onClick={()=>setDraft(d=>d.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div>;})}</div>
    <div className="dialog-actions"><button type="button" disabled={draft.length>=30} onClick={()=>setDraft(d=>[...d,{id:'',amount:''}])}><Plus size={15}/> Satır ekle</button>
      <button type="button" className="primary" disabled={!valid||save.isPending} onClick={()=>save.mutate()}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Reçeteyi kaydet'}</button></div>
    {!valid&&draft.length>0&&<p className="error-text" role="status">Her satırda farklı bir hammadde ve sıfırdan büyük miktar olmalı.</p>}
    <ErrorBox error={save.error}/>
  </section>;
}

function Costs(){
  const costs=useQuery({queryKey:['costs'],queryFn:()=>api<ProductCost[]>('/stok/maliyet')});
  return <><ErrorBox error={costs.error} retry={()=>void costs.refetch()}/>{costs.isPending?<Loading/>:<section className="op-panel"><div className="op-table-wrap"><table className="op-data-table">
    <thead><tr><th>Ürün</th><th className="num">Satış fiyatı</th><th className="num">KDV hariç</th><th className="num">Reçete maliyeti</th><th className="num">Brüt kâr</th><th className="num">Maliyet oranı</th></tr></thead>
    <tbody>{(costs.data??[]).map(c=><tr key={`${c.UrunKayitNo}-${c.PorsiyonAdi??''}`}>
      <td>{c.UrunAdi}{c.PorsiyonAdi&&<small>{c.PorsiyonAdi}</small>}</td><td className="num">{money(c.SatisFiyati)}</td><td className="num">{money(c.KdvHaricFiyat)}</td>
      <td className="num">{c.ReceteVar?money(c.ReceteMaliyeti):'—'}</td><td className="num">{c.ReceteVar?money(c.BrutKar):'—'}</td>
      <td className="num">{c.MaliyetOrani===null?<span className="op-badge">Reçete yok</span>:<span className={`op-badge ${c.MaliyetOrani>40?'is-danger':c.MaliyetOrani>30?'is-warning':'is-success'}`}>%{c.MaliyetOrani}</span>}</td></tr>)}</tbody>
  </table></div></section>}<p className="op-note" style={{marginTop:14}}>Maliyet oranı reçete maliyetinin KDV hariç satış fiyatına oranıdır. Birim maliyetler stok girişlerinde ağırlıklı ortalamayla güncellenir.</p></>;
}

function Movements({ingredients}:{ingredients:Ingredient[]}){
  const [filter,setFilter]=useState('');
  const moves=useQuery({queryKey:['stock-moves',filter],queryFn:()=>api<StockMovement[]>(`/stok/hareketler${filter?`?hammadde=${filter}`:''}`)});
  const unit=(id:number)=>ingredients.find(i=>i.KayitNo===id)?.Birim??'';
  return <>
    <div className="op-toolbar-row"><label className="op-grow">Hammadde<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tümü</option>{ingredients.map(i=><option key={i.KayitNo} value={i.KayitNo}>{i.Ad}</option>)}</select></label></div>
    <ErrorBox error={moves.error} retry={()=>void moves.refetch()}/>
    {moves.isPending?<Loading/>:(moves.data??[]).length===0?<Empty>Kayıtlı hareket yok.</Empty>:<section className="op-panel"><div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Tarih</th><th>Hammadde</th><th>Tür</th><th className="num">Miktar</th><th className="num">Sonraki stok</th><th>Açıklama</th></tr></thead>
      <tbody>{(moves.data??[]).map(m=><tr key={m.KayitNo}><td>{new Date(m.Tarih).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
        <td>{m.HammaddeAdi}</td><td>{movementNames[m.Tip]}</td><td className="num">{m.Miktar>0?'+':''}{qty(m.Miktar)} {unit(m.HammaddeKayitNo)}</td>
        <td className="num">{qty(m.StokSonrasi)}</td><td>{m.Aciklama}<small>{m.PersonelAdi}</small></td></tr>)}</tbody></table></div></section>}
  </>;
}
