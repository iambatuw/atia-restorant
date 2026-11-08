import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowUpRight,FileCheck2,Headphones,MonitorSmartphone,ReceiptText,Truck} from 'lucide-react';
import {api} from './api';
import type {Category,IncomingOrder} from './types';
import {ErrorBox,Loading} from './ui';
import {pagePath} from './routes';
import type {Page} from './routes';

const sources=[
  {name:'Hugin S1 ve PayGo',icon:MonitorSmartphone,state:'Ödeme akışında',detail:'Adisyon ödemesinde cihaz seçimi ve işlem sorgulama bulunuyor. Canlı terminal bağlantısı ayrıca kurulmalı.',route:'masalar' as Page,action:'Ödemelere git'},
  {name:'Paket servis ve kurye',icon:Truck,state:'Demo akışı hazır',detail:'Webde manuel paket siparişi, menü fiyatı, adres ve kurye durumları çalışıyor. Canlı ERP tablolarına bağlantı gerekiyor.',route:'paket-servis' as Page,action:'Paket servisi aç'},
  {name:'PlatinMarket ve Entegra siparişleri',icon:ReceiptText,state:'Demo kutusu hazır',detail:'Elle girilen siparişlerde ürün eşlemesi, mükerrer kayıt koruması ve paket servise aktarım çalışıyor. Canlı bağlantı için sağlayıcı erişimi gerekiyor.'},
  {name:'Getir Yemek',icon:ReceiptText,state:'Eski kod tamamlanmamış',detail:'Masaüstündeki dosyada giriş denemesi var; çalışan sipariş alma akışı bulunmuyor.'},
  {name:'e-Adisyon',icon:FileCheck2,state:'Web bağlantısı bekliyor',detail:'Masaüstünde gönderme ve durum sorgulama akışı var. Kullanılan sağlayıcı ve mağaza ayarları doğrulanmalı.'},
  {name:'Arayan müşteri tanıma',icon:Headphones,state:'Cihaz bağlantısı bekliyor',detail:'Eski ekran telefon donanımına bağlı çalışıyor. Web için yerel bağlantı hizmeti ve yetkilendirme tasarlanmalı.'}
];

export function Integrations({navigate}:{navigate:(page:Page)=>void}){
  return <section className="op-page op-integrations" aria-label="Entegrasyonlar">
    <header className="op-page-head"><div><h1>Entegrasyonlar</h1><p>Masaüstünden taşınabilecek bağlantıların gerçek durumu</p></div></header>
    <div className="op-integration-intro"><strong>Öncelik: paket ve çevrim içi siparişler</strong><p>Manuel paket servisi demo ortamında kullanılabilir. Sağlayıcılardan otomatik sipariş almak için güncel erişim bilgileri ve veritabanı eşlemesi gerekiyor.</p></div>
    <IncomingInbox/>
    <div className="op-integration-list">{sources.map(source=><article className="op-integration-row" key={source.name}><div className="op-integration-icon"><source.icon size={21}/></div><div><h2>{source.name}</h2><p>{source.detail}</p></div><div className="op-integration-end"><span>{source.state}</span>{source.route&&<a href={pagePath(source.route)} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(source.route!);}}}>{source.action}<ArrowUpRight size={15}/></a>}</div></article>)}</div>
  </section>;
}

function IncomingInbox(){
  const client=useQueryClient();
  const orders=useQuery({queryKey:['incoming-orders'],queryFn:()=>api<IncomingOrder[]>('/entegrasyonlar/gelen'),refetchInterval:15000});
  const menu=useQuery({queryKey:['menu','yonetim'],queryFn:()=>api<Category[]>('/menu/yonetim')});
  const products=(menu.data??[]).flatMap(category=>category.Urunler).filter(product=>product.Aktif);
  const [source,setSource]=useState<'PlatinMarket'|'Entegra'>('PlatinMarket');
  const [externalId,setExternalId]=useState('');
  const [code,setCode]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [address,setAddress]=useState('');
  const [payment,setPayment]=useState<'Nakit'|'Kart'|'Online'>('Nakit');
  const stage=useMutation({mutationFn:()=>api<IncomingOrder>('/entegrasyonlar/gelen',{method:'POST',body:JSON.stringify({Kaynak:source,HariciSiparisNo:externalId.trim(),KaynakUrunKodu:code.trim(),Miktar:quantity,MusteriAdi:name.trim(),Telefon:phone.trim(),Adres:address.trim(),OdemeSekli:payment})}),onSuccess:async()=>{await client.invalidateQueries({queryKey:['incoming-orders']});setExternalId('');setCode('');setName('');setPhone('');setAddress('');}});
  const map=useMutation({mutationFn:({id,productId}:{id:number;productId:number})=>api(`/entegrasyonlar/gelen/${id}/eslestir`,{method:'PUT',body:JSON.stringify({StokKayitNo:productId})}),onSuccess:()=>client.invalidateQueries({queryKey:['incoming-orders']})});
  const transfer=useMutation({mutationFn:(id:number)=>api(`/entegrasyonlar/gelen/${id}/aktar`,{method:'POST'}),onSuccess:()=>{void client.invalidateQueries({queryKey:['incoming-orders']});void client.invalidateQueries({queryKey:['deliveries']});}});
  return <section className="op-panel op-inbox" aria-label="Gelen sipariş kutusu"><div className="op-panel-head"><h2>Gelen sipariş kutusu</h2><small>PlatinMarket ve Entegra · demo giriş</small></div>
    <p className="op-inbox-note">Bu form sağlayıcı bağlantısı değildir. Siparişi elle ekleyip ürün kodu eşleştirmesini ve paket servise aktarımı deneyebilirsiniz. Aynı kaynak ve sipariş numarası ikinci kayıt açmaz.</p>
    <form className="op-inbox-form" onSubmit={event=>{event.preventDefault();stage.mutate();}}>
      <label>Kaynak<select value={source} onChange={event=>setSource(event.target.value as typeof source)}><option>PlatinMarket</option><option>Entegra</option></select></label>
      <label>Sipariş no<input required maxLength={80} value={externalId} onChange={event=>setExternalId(event.target.value)}/></label>
      <label>Kaynak ürün kodu<input required maxLength={80} value={code} onChange={event=>setCode(event.target.value)} placeholder="Örn. U001"/></label>
      <label>Adet<input required type="number" min={1} max={50} value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label>
      <label>Müşteri<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>Telefon<input required maxLength={30} value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <label className="op-inbox-address">Adres<input required maxLength={300} value={address} onChange={event=>setAddress(event.target.value)}/></label>
      <label>Ödeme<select value={payment} onChange={event=>setPayment(event.target.value as typeof payment)}><option>Nakit</option><option>Kart</option><option>Online</option></select></label>
      <button className="primary" disabled={stage.isPending||quantity<1||quantity>50}>{stage.isPending?'Kaydediliyor…':'Kutuya ekle'}</button>
    </form>
    <ErrorBox error={orders.error||menu.error||stage.error||map.error||transfer.error} retry={()=>void orders.refetch()}/>
    {orders.isPending?<Loading/>:orders.data?.length?<div className="op-inbox-list">{orders.data.map(order=><article key={order.KayitNo}><div><strong>{order.Kaynak} · #{order.HariciSiparisNo}</strong><span>{order.MusteriAdi} · {order.Miktar} × {order.KaynakUrunKodu}</span><small>{order.PaketSiparisNo?`Paket #${order.PaketSiparisNo} olarak aktarıldı`:order.EslesenStokKayitNo?'Ürün eşleşti':'Ürün eşleştirmesi gerekli'}</small></div>{!order.PaketSiparisNo&&<div className="op-inbox-row-actions"><select aria-label={`${order.HariciSiparisNo} ürün eşleştirmesi`} value={order.EslesenStokKayitNo??''} onChange={event=>{if(event.target.value)map.mutate({id:order.KayitNo,productId:Number(event.target.value)});}}><option value="">Ürün seçin</option>{products.map(product=><option key={product.KayitNo} value={product.KayitNo}>{product.StokAdi}</option>)}</select><button type="button" className="secondary" disabled={!order.EslesenStokKayitNo||transfer.isPending||map.isPending} onClick={()=>transfer.mutate(order.KayitNo)}>Paket servise aktar</button></div>}</article>)}</div>:<p className="op-inline-empty">Henüz gelen sipariş yok.</p>}
  </section>;
}
