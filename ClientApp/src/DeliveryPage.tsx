import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowRight,PackageCheck,Plus,Truck} from 'lucide-react';
import {api,money} from './api';
import type {Category,DeliveryOrder,DeliveryStatus,Product} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';

const statusNames=['Yeni','Hazırlanıyor','Yolda','Teslim edildi','İptal'] as const;
type DraftLine={product:Product;portionId:number|null;portionName:string|null;price:number;quantity:number};

export function DeliveryPage(){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'active'|'all'>('active');
  const [create,setCreate]=useState(false);
  const [courierFor,setCourierFor]=useState<DeliveryOrder|null>(null);
  const [courier,setCourier]=useState('');
  const orders=useQuery({queryKey:['deliveries'],queryFn:()=>api<DeliveryOrder[]>('/paket-siparisler'),refetchInterval:12000});
  const update=useMutation({mutationFn:({id,status,courierName}:{id:number;status:DeliveryStatus;courierName?:string})=>api<DeliveryOrder>(`/paket-siparisler/${id}/durum`,{method:'PATCH',body:JSON.stringify({Durum:status,Kurye:courierName})}),onSuccess:async(_result,variables)=>{await client.invalidateQueries({queryKey:['deliveries']});if(variables.status===3)setFilter('all');setCourierFor(null);setCourier('');}});
  const list=orders.data??[];
  const active=list.filter(order=>order.Durum<3);
  const visible=filter==='active'?active:list;

  return <section className="op-page op-deliveries" aria-label="Paket servis">
    <header className="op-page-head"><div><h1>Paket servis</h1><p>Adresli siparişler ve kurye teslimatı</p></div><button className="primary" onClick={()=>setCreate(true)}><Plus size={17}/> Yeni paket siparişi</button></header>
    <div className="op-delivery-toolbar" role="group" aria-label="Sipariş durumu"><button aria-pressed={filter==='active'} onClick={()=>setFilter('active')}>Aktif siparişler <span>{active.length}</span></button><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tüm kayıtlar <span>{list.length}</span></button></div>
    <ErrorBox error={orders.error||update.error} retry={()=>void orders.refetch()}/>
    {orders.isPending?<Loading/>:visible.length===0?<Empty><Truck size={28}/><h2>{filter==='active'?'Aktif paket siparişi yok':'Paket siparişi yok'}</h2><p>Yeni paket siparişi açarak teslimat akışını başlatın.</p></Empty>:<div className="op-delivery-list">
      {visible.map(order=><article className="op-delivery-row" key={order.KayitNo}>
        <div className="op-delivery-head"><div><span>#{order.KayitNo}, {new Date(order.KayitTarihi).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span><h2>{order.MusteriAdi}</h2><p>{order.Adres}</p><a href={`tel:${order.Telefon}`}>{order.Telefon}</a></div><div><strong>{money(order.GenelToplam)}</strong><span className="op-delivery-status">{statusNames[order.Durum]}</span></div></div>
        <div className="op-delivery-items">{order.Satirlar.map((line,index)=><span key={`${line.StokKayitNo}-${index}`}>{line.Miktar}× {line.StokAdi}{line.PorsiyonAdi?` (${line.PorsiyonAdi})`:''}</span>)}</div>
        <footer><span>{order.OdemeSekli}{order.Kurye?`, kurye: ${order.Kurye}`:''}{order.Aciklama?`, not: ${order.Aciklama}`:''}</span><div>{order.Durum===0&&<button className="secondary" disabled={update.isPending} onClick={()=>update.mutate({id:order.KayitNo,status:1})}>Hazırlamaya başla <ArrowRight size={15}/></button>}{order.Durum===1&&<button className="secondary" disabled={update.isPending} onClick={()=>{setCourierFor(order);setCourier('');}}>Kuryeye ver <ArrowRight size={15}/></button>}{order.Durum===2&&<button className="secondary" disabled={update.isPending} onClick={()=>update.mutate({id:order.KayitNo,status:3})}><PackageCheck size={16}/> Teslim edildi</button>}</div></footer>
      </article>)}
    </div>}
    {create&&<NewDelivery close={()=>setCreate(false)}/>}
    {courierFor&&<Modal title={`#${courierFor.KayitNo} kuryeye ver`} onClose={()=>setCourierFor(null)}><form className="craft-form" onSubmit={event=>{event.preventDefault();update.mutate({id:courierFor.KayitNo,status:2,courierName:courier.trim()});}}><label>Kurye adı<input autoFocus required maxLength={100} value={courier} onChange={event=>setCourier(event.target.value)}/></label><ErrorBox error={update.error}/><div className="dialog-actions"><button type="button" onClick={()=>setCourierFor(null)}>Vazgeç</button><button className="primary" type="submit" disabled={update.isPending||!courier.trim()}>Yola çıkar</button></div></form></Modal>}
  </section>;
}

function NewDelivery({close}:{close:()=>void}){
  const client=useQueryClient();
  const menu=useQuery({queryKey:['menu'],queryFn:()=>api<Category[]>('/menu')});
  const [idempotencyKey]=useState(()=>crypto.randomUUID());
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [address,setAddress]=useState('');
  const [note,setNote]=useState('');
  const [payment,setPayment]=useState('Nakit');
  const [productId,setProductId]=useState('');
  const [portionId,setPortionId]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [draft,setDraft]=useState<DraftLine[]>([]);
  const products=(menu.data??[]).flatMap(category=>category.Urunler).filter(product=>product.Aktif);
  const product=products.find(item=>String(item.KayitNo)===productId);
  const portion=product?.Porsiyonlar.find(item=>String(item.KayitNo)===portionId);
  const addLine=()=>{if(!product||quantity<1||quantity>50||(product.Porsiyonlar.length>0&&!portion))return;setDraft(lines=>[...lines,{product,portionId:portion?.KayitNo??null,portionName:portion?.PorsiyonAdi??null,price:portion?.Fiyat??product.SatisFiyati,quantity}]);setProductId('');setPortionId('');setQuantity(1);};
  const create=useMutation({mutationFn:()=>api<DeliveryOrder>('/paket-siparisler',{method:'POST',body:JSON.stringify({IdempotencyKey:idempotencyKey,MusteriAdi:name.trim(),Telefon:phone.trim(),Adres:address.trim(),Aciklama:note.trim(),OdemeSekli:payment,Satirlar:draft.map(line=>({StokKayitNo:line.product.KayitNo,PorsiyonKayitNo:line.portionId,Miktar:line.quantity}))})}),onSuccess:async()=>{await client.invalidateQueries({queryKey:['deliveries']});close();}});
  const estimated=draft.reduce((sum,line)=>sum+line.price*line.quantity,0);
  return <Modal title="Yeni paket siparişi" onClose={()=>{if(!create.isPending)close();}}><form className="craft-form op-delivery-form" onSubmit={event=>{event.preventDefault();create.mutate();}}>
    <div className="form-row"><label>Müşteri adı<input autoFocus required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label><label>Telefon<input required type="tel" maxLength={30} value={phone} onChange={event=>setPhone(event.target.value)}/></label></div>
    <label>Teslimat adresi<textarea required maxLength={300} rows={2} value={address} onChange={event=>setAddress(event.target.value)}/></label>
    <div className="form-row"><label>Ödeme şekli<select value={payment} onChange={event=>setPayment(event.target.value)}><option value="Nakit">Kapıda nakit</option><option value="Kart">Kapıda kart</option><option value="Online">Çevrim içi ödenmiş</option></select></label><label>Sipariş notu<input maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label></div>
    <fieldset className="op-delivery-picker"><legend>Ürünler</legend><div className="op-delivery-picker-controls"><select aria-label="Ürün seç" value={productId} onChange={event=>{setProductId(event.target.value);setPortionId('');}}><option value="">Ürün seçin</option>{products.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.StokAdi} ({money(item.SatisFiyati)})</option>)}</select>{product&&product.Porsiyonlar.length>0&&<select aria-label="Porsiyon seç" value={portionId} onChange={event=>setPortionId(event.target.value)}><option value="">Porsiyon seçin</option>{product.Porsiyonlar.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.PorsiyonAdi} ({money(item.Fiyat)})</option>)}</select>}<input type="number" aria-label="Adet" min="1" max="50" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/><button type="button" className="secondary" disabled={!product||(product.Porsiyonlar.length>0&&!portion)} onClick={addLine}><Plus size={16}/> Ekle</button></div>
      {draft.length>0?<div className="op-delivery-draft">{draft.map((line,index)=><div key={index}><span>{line.quantity}× {line.product.StokAdi}{line.portionName?`, ${line.portionName}`:''}</span><strong>{money(line.price*line.quantity)}</strong><button type="button" aria-label={`${line.product.StokAdi} ürününü kaldır`} onClick={()=>setDraft(lines=>lines.filter((_,i)=>i!==index))}>Kaldır</button></div>)}<p>Toplam: <strong>{money(estimated)}</strong></p></div>:<p className="op-picker-empty">Henüz ürün eklenmedi.</p>}</fieldset>
    <ErrorBox error={menu.error||create.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" type="submit" disabled={create.isPending||draft.length===0}>{create.isPending?'Kaydediliyor…':'Siparişi kaydet'}</button></div>
  </form></Modal>;
}
