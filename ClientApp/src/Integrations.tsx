import {ArrowUpRight,FileCheck2,Headphones,MonitorSmartphone,ReceiptText,Truck} from 'lucide-react';
import {pagePath} from './routes';
import type {Page} from './routes';

const sources=[
  {name:'Hugin S1 ve PayGo',icon:MonitorSmartphone,state:'Ödeme akışında',detail:'Adisyon ödemesinde cihaz seçimi ve işlem sorgulama bulunuyor. Canlı terminal bağlantısı ayrıca kurulmalı.',route:'masalar' as Page,action:'Ödemelere git'},
  {name:'Paket servis ve kurye',icon:Truck,state:'Demo akışı hazır',detail:'Webde manuel paket siparişi, menü fiyatı, adres ve kurye durumları çalışıyor. Canlı ERP tablolarına bağlantı gerekiyor.',route:'paket-servis' as Page,action:'Paket servisi aç'},
  {name:'PlatinMarket ve Entegra siparişleri',icon:ReceiptText,state:'Web bağlantısı bekliyor',detail:'Eski kod iki ayrı sipariş kaynağına sahip. Sağlayıcı erişimi, ürün eşlemesi ve mükerrer sipariş koruması yeniden kurulmalı.'},
  {name:'Getir Yemek',icon:ReceiptText,state:'Eski kod tamamlanmamış',detail:'Masaüstündeki dosyada giriş denemesi var; çalışan sipariş alma akışı bulunmuyor.'},
  {name:'e-Adisyon',icon:FileCheck2,state:'Web bağlantısı bekliyor',detail:'Masaüstünde gönderme ve durum sorgulama akışı var. Kullanılan sağlayıcı ve mağaza ayarları doğrulanmalı.'},
  {name:'Arayan müşteri tanıma',icon:Headphones,state:'Cihaz bağlantısı bekliyor',detail:'Eski ekran telefon donanımına bağlı çalışıyor. Web için yerel bağlantı hizmeti ve yetkilendirme tasarlanmalı.'}
];

export function Integrations({navigate}:{navigate:(page:Page)=>void}){
  return <section className="op-page op-integrations" aria-label="Entegrasyonlar">
    <header className="op-page-head"><div><h1>Entegrasyonlar</h1><p>Masaüstünden taşınabilecek bağlantıların gerçek durumu</p></div></header>
    <div className="op-integration-intro"><strong>Öncelik: paket ve çevrim içi siparişler</strong><p>Manuel paket servisi demo ortamında kullanılabilir. Sağlayıcılardan otomatik sipariş almak için güncel erişim bilgileri ve veritabanı eşlemesi gerekiyor.</p></div>
    <div className="op-integration-list">{sources.map(source=><article className="op-integration-row" key={source.name}><div className="op-integration-icon"><source.icon size={21}/></div><div><h2>{source.name}</h2><p>{source.detail}</p></div><div className="op-integration-end"><span>{source.state}</span>{source.route&&<a href={pagePath(source.route)} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(source.route!);}}}>{source.action}<ArrowUpRight size={15}/></a>}</div></article>)}</div>
  </section>;
}
