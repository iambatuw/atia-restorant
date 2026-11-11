import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowRight,BadgeCheck,PackageCheck,Pencil,Plus,Trash2,Truck,UserRound} from 'lucide-react';
import {api,money} from './api';
import type {Category,Courier,Customer,CustomerDetail,DeliveryOrder,DeliveryStatus,Product} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import {OptionChooser} from './Options';
import './Extensions.css';

const statusNames=['Yeni','Hazırlanıyor','Yolda','Teslim edildi','İptal'] as const;
type DraftLine={product:Product;portionId:number|null;portionName:string|null;price:number;quantity:number;options:number[];optionText:string};

export function DeliveryPage({admin=false}:{admin?:boolean}){
  const [tab,setTab]=useState<'orders'|'customers'|'couriers'>('orders');
  return <section className="op-page op-deliveries" aria-label="Paket servis">
    {tab==='orders'?<Orders admin={admin} tabs={<Tabs tab={tab} setTab={setTab} admin={admin}/>}/>:<>
      <header className="op-page-head"><div><h1>Paket servis</h1><p>{tab==='customers'?'Telefonla bulunan müşteri kartları':'Kurye tanımları'}</p></div></header>
      <Tabs tab={tab} setTab={setTab} admin={admin}/>
      {tab==='customers'?<Customers admin={admin}/>:<Couriers/>}
    </>}
  </section>;
}

function Tabs({tab,setTab,admin}:{tab:string;setTab:(t:'orders'|'customers'|'couriers')=>void;admin:boolean}){
  return <div className="op-tabs" role="group" aria-label="Paket servis bölümleri">
    <button aria-pressed={tab==='orders'} onClick={()=>setTab('orders')}>Siparişler</button>
    <button aria-pressed={tab==='customers'} onClick={()=>setTab('customers')}>Müşteriler</button>
    {admin&&<button aria-pressed={tab==='couriers'} onClick={()=>setTab('couriers')}>Kuryeler</button>}
  </div>;
}

function Orders({admin,tabs}:{admin:boolean;tabs:React.ReactNode}){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'active'|'all'>('active');
  const [create,setCreate]=useState(false);
  const [courierFor,setCourierFor]=useState<DeliveryOrder|null>(null);
  const [courier,setCourier]=useState('');
  const [courierId,setCourierId]=useState('');
  const orders=useQuery({queryKey:['deliveries'],queryFn:()=>api<DeliveryOrder[]>('/paket-siparisler'),refetchInterval:12000});
  const couriers=useQuery({queryKey:['couriers'],queryFn:()=>api<Courier[]>('/kuryeler')});
  const activeCouriers=(couriers.data??[]).filter(c=>c.Aktif);
  const update=useMutation({mutationFn:({id,status,courierName,courierKey}:{id:number;status:DeliveryStatus;courierName?:string;courierKey?:number})=>api<DeliveryOrder>(`/paket-siparisler/${id}/durum`,{method:'PATCH',body:JSON.stringify({Durum:status,Kurye:courierName,KuryeKayitNo:courierKey})}),onSuccess:async(_result,variables)=>{await client.invalidateQueries({queryKey:['deliveries']});if(variables.status===3)setFilter('all');setCourierFor(null);setCourier('');setCourierId('');}});
  const collect=useMutation({mutationFn:(id:number)=>api(`/paket-siparisler/${id}/tahsilat`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  const list=orders.data??[];
  const active=list.filter(order=>order.Durum<3);
  const uncollected=list.filter(order=>order.Durum===3&&!order.TahsilEdildi);
  const visible=filter==='active'?active:list;

  return <>
    <header className="op-page-head"><div><h1>Paket servis</h1><p>Adresli siparişler, kurye teslimatı ve tahsilat</p></div><button className="primary" onClick={()=>setCreate(true)}><Plus size={17}/> Yeni paket siparişi</button></header>
    {tabs}
    <div className="op-delivery-toolbar" role="group" aria-label="Sipariş durumu"><button aria-pressed={filter==='active'} onClick={()=>setFilter('active')}>Aktif siparişler <span>{active.length}</span></button><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tüm kayıtlar <span>{list.length}</span></button>{uncollected.length>0&&<span className="op-badge is-warning" style={{alignSelf:'center'}}>{uncollected.length} teslimatın tahsilatı bekliyor</span>}</div>
    <ErrorBox error={orders.error||update.error||collect.error} retry={()=>void orders.refetch()}/>
    {orders.isPending?<Loading/>:visible.length===0?<Empty><Truck size={28}/><h2>{filter==='active'?'Aktif paket siparişi yok':'Paket siparişi yok'}</h2><p>Yeni paket siparişi açarak teslimat akışını başlatın.</p></Empty>:<div className="op-delivery-list">
      {visible.map(order=><article className="op-delivery-row" key={order.KayitNo}>
        <div className="op-delivery-head"><div><span>#{order.KayitNo}, {new Date(order.KayitTarihi).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span><h2>{order.MusteriAdi}</h2><p>{order.Adres}</p><a href={`tel:${order.Telefon}`}>{order.Telefon}</a></div><div><strong>{money(order.GenelToplam)}</strong><span className="op-delivery-status">{statusNames[order.Durum]}</span>{order.Durum===3&&<span className={`op-badge ${order.TahsilEdildi?'is-success':'is-warning'}`}>{order.TahsilEdildi?'Tahsil edildi':'Tahsilat bekliyor'}</span>}</div></div>
        <div className="op-delivery-items">{order.Satirlar.map((line,index)=><span key={`${line.StokKayitNo}-${index}`}>{line.Miktar}× {line.StokAdi}{line.PorsiyonAdi?` (${line.PorsiyonAdi})`:''}{line.SecimMetni?` · ${line.SecimMetni}`:''}</span>)}</div>
        <footer><span>{order.OdemeSekli}{order.Kurye?`, kurye: ${order.Kurye}`:''}{order.Aciklama?`, not: ${order.Aciklama}`:''}{order.TahsilEden?`, tahsil eden: ${order.TahsilEden}`:''}</span><div>
          {order.Durum===0&&<button className="secondary" disabled={update.isPending} onClick={()=>update.mutate({id:order.KayitNo,status:1})}>Hazırlamaya başla <ArrowRight size={15}/></button>}
          {order.Durum===1&&<button className="secondary" disabled={update.isPending} onClick={()=>{setCourierFor(order);setCourier('');setCourierId(activeCouriers[0]?String(activeCouriers[0].KayitNo):'');}}>Kuryeye ver <ArrowRight size={15}/></button>}
          {order.Durum===2&&<button className="secondary" disabled={update.isPending} onClick={()=>update.mutate({id:order.KayitNo,status:3})}><PackageCheck size={16}/> Teslim edildi</button>}
          {order.Durum===3&&!order.TahsilEdildi&&admin&&<button className="secondary" disabled={collect.isPending} onClick={()=>collect.mutate(order.KayitNo)} title={order.OdemeSekli==='Online'?'Platform ödemesini doğrula':'Kuryeden alınan ödemeyi kasaya işle'}><BadgeCheck size={16}/> {order.OdemeSekli==='Online'?'Ödemeyi doğrula':'Tahsil edildi'}</button>}
        </div></footer>
      </article>)}
    </div>}
    {create&&<NewDelivery close={()=>setCreate(false)}/>}
    {courierFor&&<Modal title={`#${courierFor.KayitNo} kuryeye ver`} onClose={()=>setCourierFor(null)}><form className="craft-form" onSubmit={event=>{event.preventDefault();
      if(courierId) update.mutate({id:courierFor.KayitNo,status:2,courierKey:Number(courierId)}); else update.mutate({id:courierFor.KayitNo,status:2,courierName:courier.trim()});}}>
      {activeCouriers.length>0&&<label>Kurye<select autoFocus value={courierId} onChange={event=>setCourierId(event.target.value)}>{activeCouriers.map(c=><option key={c.KayitNo} value={c.KayitNo}>{c.AdSoyad}</option>)}<option value="">Listede yok, adını yaz</option></select></label>}
      {!courierId&&<label>Kurye adı<input autoFocus required maxLength={100} value={courier} onChange={event=>setCourier(event.target.value)}/></label>}
      <ErrorBox error={update.error}/><div className="dialog-actions"><button type="button" onClick={()=>setCourierFor(null)}>Vazgeç</button><button className="primary" type="submit" disabled={update.isPending||(!courierId&&!courier.trim())}>Yola çıkar</button></div></form></Modal>}
  </>;
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
  const [choosing,setChoosing]=useState(false);
  const [draft,setDraft]=useState<DraftLine[]>([]);
  const digits=phone.replace(/\D/g,'');
  const lookup=useQuery({queryKey:['customer-lookup',digits],queryFn:()=>api<Customer[]>(`/musteriler?ara=${encodeURIComponent(digits)}`),enabled:digits.length>=7,staleTime:30000});
  const match=lookup.data?.[0];
  const products=(menu.data??[]).flatMap(category=>category.Urunler).filter(product=>product.Aktif);
  const product=products.find(item=>String(item.KayitNo)===productId);
  const portion=product?.Porsiyonlar.find(item=>String(item.KayitNo)===portionId);
  const basePrice=portion?.Fiyat??product?.SatisFiyati??0;
  const ready=!!product&&quantity>=1&&quantity<=50&&(product.Porsiyonlar.length===0||!!portion);
  const pushLine=(ids:number[])=>{
    if(!product)return;
    const chosen=(product.SecenekGruplari??[]).flatMap(g=>g.Secenekler).filter(o=>ids.includes(o.KayitNo));
    setDraft(lines=>[...lines,{product,portionId:portion?.KayitNo??null,portionName:portion?.PorsiyonAdi??null,price:basePrice+chosen.reduce((s,o)=>s+o.EkFiyat,0),quantity,
      options:chosen.map(o=>o.KayitNo),optionText:chosen.map(o=>o.Ad).join(', ')}]);
    setProductId('');setPortionId('');setQuantity(1);setChoosing(false);
  };
  const addLine=()=>{if(!ready)return;if((product!.SecenekGruplari?.length??0)>0){setChoosing(true);return;}pushLine([]);};
  const create=useMutation({mutationFn:()=>api<DeliveryOrder>('/paket-siparisler',{method:'POST',body:JSON.stringify({IdempotencyKey:idempotencyKey,MusteriAdi:name.trim(),Telefon:phone.trim(),Adres:address.trim(),Aciklama:note.trim(),OdemeSekli:payment,
    Satirlar:draft.map(line=>({StokKayitNo:line.product.KayitNo,PorsiyonKayitNo:line.portionId,Miktar:line.quantity,SecenekKayitNolar:line.options}))})}),onSuccess:async()=>{await client.invalidateQueries({queryKey:['deliveries']});await client.invalidateQueries({queryKey:['customers']});close();}});
  const estimated=draft.reduce((sum,line)=>sum+line.price*line.quantity,0);
  return <Modal title="Yeni paket siparişi" onClose={()=>{if(!create.isPending)close();}}><form className="craft-form op-delivery-form" onSubmit={event=>{event.preventDefault();create.mutate();}}>
    <div className="form-row"><label>Telefon<input autoFocus required type="tel" maxLength={30} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Önce telefonu yazın"/></label><label>Müşteri adı<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label></div>
    {match&&<div className="op-customer-hit" role="status"><div><UserRound size={15}/> <strong>{match.AdSoyad}</strong> · {match.SiparisSayisi} sipariş{match.SonSiparisTarihi?`, son ${new Date(match.SonSiparisTarihi).toLocaleDateString('tr-TR')}`:''}{match.Not?` · ${match.Not}`:''}</div>
      <div className="op-chip-row">{!name&&<button type="button" className="op-chip" onClick={()=>setName(match.AdSoyad)}>Adı kullan</button>}{match.Adresler.map(item=><button type="button" key={item} className="op-chip" aria-pressed={address===item} onClick={()=>{setAddress(item);if(!name)setName(match.AdSoyad);}}>{item}</button>)}</div></div>}
    <label>Teslimat adresi<textarea required maxLength={300} rows={2} value={address} onChange={event=>setAddress(event.target.value)}/></label>
    <div className="form-row"><label>Ödeme şekli<select value={payment} onChange={event=>setPayment(event.target.value)}><option value="Nakit">Kapıda nakit</option><option value="Kart">Kapıda kart</option><option value="Online">Çevrim içi ödenmiş</option></select></label><label>Sipariş notu<input maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label></div>
    <fieldset className="op-delivery-picker"><legend>Ürünler</legend><div className="op-delivery-picker-controls"><select aria-label="Ürün seç" value={productId} onChange={event=>{setProductId(event.target.value);setPortionId('');setChoosing(false);}}><option value="">Ürün seçin</option>{products.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.StokAdi} ({money(item.SatisFiyati)}){(item.SecenekGruplari?.length??0)>0?' · seçenekli':''}</option>)}</select>{product&&product.Porsiyonlar.length>0&&<select aria-label="Porsiyon seç" value={portionId} onChange={event=>setPortionId(event.target.value)}><option value="">Porsiyon seçin</option>{product.Porsiyonlar.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.PorsiyonAdi} ({money(item.Fiyat)})</option>)}</select>}<input type="number" aria-label="Adet" min="1" max="50" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/><button type="button" className="secondary" disabled={!ready} onClick={addLine}><Plus size={16}/> Ekle</button></div>
      {choosing&&product&&<OptionChooser key={`${product.KayitNo}-${portionId}`} product={product} basePrice={basePrice} onCancel={()=>setChoosing(false)} onConfirm={pushLine}/>}
      {draft.length>0?<div className="op-delivery-draft">{draft.map((line,index)=><div key={index}><span>{line.quantity}× {line.product.StokAdi}{line.portionName?`, ${line.portionName}`:''}{line.optionText?` · ${line.optionText}`:''}</span><strong>{money(line.price*line.quantity)}</strong><button type="button" aria-label={`${line.product.StokAdi} ürününü kaldır`} onClick={()=>setDraft(lines=>lines.filter((_,i)=>i!==index))}>Kaldır</button></div>)}<p>Toplam: <strong>{money(estimated)}</strong></p></div>:<p className="op-picker-empty">Henüz ürün eklenmedi.</p>}</fieldset>
    <p className="op-note">Telefon numarasıyla müşteri kartı oluşturulur veya güncellenir; sonraki siparişte adres hazır gelir.</p>
    <ErrorBox error={menu.error||create.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" type="submit" disabled={create.isPending||draft.length===0}>{create.isPending?'Kaydediliyor…':'Siparişi kaydet'}</button></div>
  </form></Modal>;
}

function Customers({admin}:{admin:boolean}){
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const customers=useQuery({queryKey:['customers',search.trim()],queryFn:()=>api<Customer[]>(`/musteriler${search.trim()?`?ara=${encodeURIComponent(search.trim())}`:''}`)});
  const list=customers.data??[];
  return <>
    <div className="op-toolbar-row"><label className="op-grow">Ara<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Telefon veya ad"/></label></div>
    <ErrorBox error={customers.error} retry={()=>void customers.refetch()}/>
    {customers.isPending?<Loading/>:list.length===0?<Empty><UserRound size={28}/><h2>Müşteri bulunamadı</h2><p>Müşteri kartları ilk paket siparişinde telefonla oluşur.</p></Empty>:
    <section className="op-panel"><div className="op-table-wrap"><table className="op-data-table"><thead><tr><th>Müşteri</th><th>Telefon</th><th className="num">Sipariş</th><th className="num">Toplam</th><th>Son sipariş</th><th></th></tr></thead>
      <tbody>{list.map(c=><tr key={c.KayitNo}><td><strong>{c.AdSoyad}</strong><small>{c.Adresler[0]}</small></td><td>{c.Telefon}</td><td className="num">{c.SiparisSayisi}</td><td className="num">{money(c.ToplamTutar)}</td>
        <td>{c.SonSiparisTarihi?new Date(c.SonSiparisTarihi).toLocaleDateString('tr-TR'):'—'}</td><td className="num"><button className="secondary" onClick={()=>setSelected(c.KayitNo)}><Pencil size={15}/> Aç</button></td></tr>)}</tbody></table></div></section>}
    <p className="op-note" style={{marginTop:14}}>Müşteri kartı kişisel veri içerir. Silme talebinde kart silinir; geçmiş siparişler yalnızca kendi teslimat bilgisini korur.</p>
    {selected!==null&&<CustomerEditor id={selected} admin={admin} close={()=>setSelected(null)}/>}
  </>;
}

function CustomerEditor({id,admin,close}:{id:number;admin:boolean;close:()=>void}){
  const client=useQueryClient();
  const detail=useQuery({queryKey:['customer',id],queryFn:()=>api<CustomerDetail>(`/musteriler/${id}`)});
  return <Modal title="Müşteri kartı" onClose={close}>
    <ErrorBox error={detail.error} retry={()=>void detail.refetch()}/>
    {detail.isPending||!detail.data?<Loading/>:<CustomerForm key={JSON.stringify(detail.data.Musteri)} detail={detail.data} admin={admin} done={async()=>{await client.invalidateQueries();close();}} close={close}/>}
  </Modal>;
}

function CustomerForm({detail,admin,done,close}:{detail:CustomerDetail;admin:boolean;done:()=>Promise<void>;close:()=>void}){
  const c=detail.Musteri;
  const [name,setName]=useState(c.AdSoyad);
  const [note,setNote]=useState(c.Not??'');
  const [addresses,setAddresses]=useState(c.Adresler);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const save=useMutation({mutationFn:()=>api(`/musteriler/${c.KayitNo}`,{method:'PUT',body:JSON.stringify({AdSoyad:name.trim(),Not:note.trim()||null,Adresler:addresses.map(a=>a.trim()).filter(Boolean)})}),onSuccess:done});
  const remove=useMutation({mutationFn:()=>api(`/musteriler/${c.KayitNo}`,{method:'DELETE'}),onSuccess:done});
  return <form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <p className="op-note">{c.Telefon} · {c.SiparisSayisi} sipariş · {money(c.ToplamTutar)}</p>
    <div className="form-row"><label>Ad soyad<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Not<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="ör. zili çalışmıyor"/></label></div>
    {addresses.map((a,i)=><div className="form-row op-portion-row" key={i}><label>Adres {i+1}<input maxLength={300} value={a} onChange={e=>setAddresses(list=>list.map((x,j)=>j===i?e.target.value:x))}/></label><button type="button" onClick={()=>setAddresses(list=>list.filter((_,j)=>j!==i))} aria-label={`Adres ${i+1} kaldır`}>Kaldır</button></div>)}
    {addresses.length<5&&<button type="button" className="secondary" onClick={()=>setAddresses(list=>[...list,''])}><Plus size={15}/> Adres ekle</button>}
    {detail.SonSiparisler.length>0&&<div className="op-report-rows">{detail.SonSiparisler.map(o=><div key={o.KayitNo}><span>#{o.KayitNo} · {new Date(o.KayitTarihi).toLocaleDateString('tr-TR')}<small>{o.Satirlar.map(l=>`${l.Miktar}× ${l.StokAdi}`).join(', ')}</small></span><strong>{money(o.GenelToplam)}</strong></div>)}</div>}
    <ErrorBox error={save.error||remove.error}/>
    {confirmDelete&&<p className="error-text" role="alert">Kart kalıcı olarak silinecek. Emin misiniz?</p>}
    <div className="dialog-actions">
      {admin&&(confirmDelete?<button type="button" className="danger" disabled={remove.isPending} onClick={()=>remove.mutate()}><Trash2 size={15}/> Evet, sil</button>:<button type="button" onClick={()=>setConfirmDelete(true)}><Trash2 size={15}/> Kartı sil</button>)}
      <button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={save.isPending||!name.trim()}>Kaydet</button></div>
  </form>;
}

function Couriers(){
  const client=useQueryClient();
  const couriers=useQuery({queryKey:['couriers'],queryFn:()=>api<Courier[]>('/kuryeler')});
  return <>{couriers.isPending?<Loading/>:<CourierForm key={JSON.stringify(couriers.data)} list={couriers.data??[]} saved={()=>client.invalidateQueries({queryKey:['couriers']})}/>}<ErrorBox error={couriers.error}/></>;
}

function CourierForm({list,saved}:{list:Courier[];saved:()=>Promise<void>}){
  const [draft,setDraft]=useState(list.map(c=>({...c,Telefon:c.Telefon??''})));
  const save=useMutation({mutationFn:()=>api('/kuryeler',{method:'PUT',body:JSON.stringify({Kuryeler:draft.map(c=>({...c,AdSoyad:c.AdSoyad.trim(),Telefon:c.Telefon.trim()||null}))})}),onSuccess:saved});
  return <form className="op-form-card" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <h2>Kuryeler</h2><p>Siparişi yola çıkarırken listeden seçilir. Günlük raporda kurye bazında teslimat ve tahsilat görünür. Ayrılan kuryeyi silmek yerine pasif yapın.</p>
    <div className="op-list-editor">{draft.map((c,i)=><div key={i}>
      <label>Ad soyad<input required maxLength={100} value={c.AdSoyad} onChange={e=>setDraft(d=>d.map((x,j)=>j===i?{...x,AdSoyad:e.target.value}:x))}/></label>
      <label>Telefon<input maxLength={30} value={c.Telefon} onChange={e=>setDraft(d=>d.map((x,j)=>j===i?{...x,Telefon:e.target.value}:x))}/></label>
      <label className="op-check-label"><input type="checkbox" checked={c.Aktif} onChange={e=>setDraft(d=>d.map((x,j)=>j===i?{...x,Aktif:e.target.checked}:x))}/> Aktif</label></div>)}</div>
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" disabled={draft.length>=50} onClick={()=>setDraft(d=>[...d,{KayitNo:0,AdSoyad:'',Telefon:'',Aktif:true}])}><Plus size={15}/> Kurye ekle</button>
      <button className="primary" disabled={save.isPending||draft.some(c=>!c.AdSoyad.trim())}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Kaydet'}</button></div>
  </form>;
}
