import {useQuery} from '@tanstack/react-query';
import {ArrowUpRight,ChefHat,Clock3,ReceiptText,Table2} from 'lucide-react';
import {api,localDate,money} from './api';
import type {DeliveryOrder,KitchenTicket,Report,Table} from './types';
import {ErrorBox,Loading} from './ui';
import {pagePath} from './routes';
import type {Page} from './routes';

export function Overview({navigate}:{navigate:(page:Page)=>void}){
  const tables=useQuery({queryKey:['tables'],queryFn:()=>api<Table[]>('/masalar'),refetchInterval:15000});
  const kitchen=useQuery({queryKey:['kitchen'],queryFn:()=>api<KitchenTicket[]>('/mutfak'),refetchInterval:10000});
  const report=useQuery({queryKey:['report',localDate()],queryFn:()=>api<Report>(`/raporlar/gunluk?tarih=${localDate()}`),refetchInterval:15000});
  const deliveries=useQuery({queryKey:['deliveries'],queryFn:()=>api<DeliveryOrder[]>('/paket-siparisler'),refetchInterval:12000});
  const open=(tables.data??[]).filter(t=>!!t.BaslikKayitNo);
  const waiting=kitchen.data??[];
  const late=waiting.filter(t=>t.BeklemeSuresi>=15);
  const link=(page:Page)=>(event:React.MouseEvent<HTMLAnchorElement>)=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(page);}};

  return <section className="op-page op-overview" aria-label="Genel bakış">
    <header className="op-page-head">
      <div><h1>Bugünün servisi</h1><p>{new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}. Salon ve mutfağın anlık durumu</p></div>
      <a className="op-head-link" href={pagePath('masalar')} onClick={link('masalar')}>Masalara git <ArrowUpRight size={17}/></a>
    </header>
    <ErrorBox error={tables.error||kitchen.error||report.error} retry={()=>{void tables.refetch();void kitchen.refetch();void report.refetch();}}/>
    {tables.isPending||kitchen.isPending||report.isPending?<Loading/>:<>
      <div className="op-summary-strip">
        <div><span>Açık masa</span><strong>{open.length}<small> / {tables.data?.length??0}</small></strong></div>
        <div><span>Mutfakta bekleyen</span><strong>{waiting.length}</strong><em>{late.length>0?`${late.length} sipariş 15 dakikayı geçti`:'Geciken sipariş yok'}</em></div>
        <div><span>Bugün kapanan adisyon</span><strong>{report.data?.ToplamAdisyon??0}</strong></div>
        <div><span>Bugünkü tahsilat</span><strong>{money(report.data?.ToplamCiro)}</strong></div>
      </div>
      <div className="op-overview-columns">
        <section className="op-panel"><div className="op-panel-head"><div><Table2 size={19}/><h2>Açık masalar</h2></div><a href={pagePath('masalar')} onClick={link('masalar')}>Tüm masalar</a></div>
          {open.length?<div className="op-data-list">{open.slice(0,7).map(t=><div className="op-data-row" key={t.MasaId}><div><strong>{t.MasaAdi}</strong><span>{t.RestorantBolumAdi}, {t.KisiSayisi} kişi</span></div><b>{money(t.Tutar)}</b></div>)}</div>:<div className="op-inline-empty">Açık masa bulunmuyor.</div>}
        </section>
        <section className="op-panel"><div className="op-panel-head"><div><ChefHat size={19}/><h2>Mutfak sırası</h2></div><a href={pagePath('mutfak')} onClick={link('mutfak')}>Mutfak ekranı</a></div>
          {waiting.length?<div className="op-data-list">{waiting.slice(0,7).map(t=><div className="op-data-row" key={t.BaslikKayitNo}><div><strong>{t.MasaAdi}</strong><span>{t.Satirlar.map(s=>s.StokAdi).slice(0,2).join(', ')}</span></div><b className={t.BeklemeSuresi>=15?'op-overdue':''}><Clock3 size={14}/>{t.BeklemeSuresi} dk</b></div>)}</div>:<div className="op-inline-empty">Mutfakta bekleyen sipariş yok.</div>}
        </section>
      </div>
      <div className="op-overview-foot"><ReceiptText size={18}/><span>Ödeme ve masa taşıma işlemleri masa adisyonundan yapılır.</span><a href={pagePath('paket-servis')} onClick={link('paket-servis')}>Paket servis: {deliveries.data?.filter(d=>d.Durum<3).length??'—'} aktif</a><a href={pagePath('raporlar')} onClick={link('raporlar')}>Günlük rapor</a></div>
    </>}
  </section>;
}
