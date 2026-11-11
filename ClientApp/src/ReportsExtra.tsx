import {useState} from 'react';
import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,localDate,money} from './api';
import type {CourierSummary,DeliveryCollection,MealCardSummary,PeriodReport,StaffReport,VatRow} from './types';
import {Empty,ErrorBox,Loading} from './ui';
import './Extensions.css';

export type ReportTab='gunluk'|'donem'|'personel';

export function ReportTabs({tab,setTab}:{tab:ReportTab;setTab:(tab:ReportTab)=>void}){
  return <div className="op-tabs" role="group" aria-label="Rapor türü">
    {([['gunluk','Günlük'],['donem','Dönem / ay sonu'],['personel','Personel']] as const).map(([id,label])=>
      <button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
  </div>;
}

export function VatTable({rows,title='KDV dağılımı',note}:{rows:VatRow[];title?:string;note?:string}){
  return <section className="op-panel"><div className="op-panel-head"><h2>{title}</h2>{note&&<small>{note}</small>}</div>
    {rows.length===0?<div className="op-inline-empty">Bu aralıkta KDV’li satış yok.</div>:<div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Oran</th><th className="num">Matrah</th><th className="num">KDV</th><th className="num">KDV dahil</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.Oran}><td>%{r.Oran}</td><td className="num">{money(r.Matrah)}</td><td className="num">{money(r.Kdv)}</td><td className="num">{money(r.Toplam)}</td></tr>)}</tbody>
      <tfoot><tr><td>Toplam</td><td className="num">{money(rows.reduce((s,r)=>s+r.Matrah,0))}</td><td className="num">{money(rows.reduce((s,r)=>s+r.Kdv,0))}</td><td className="num">{money(rows.reduce((s,r)=>s+r.Toplam,0))}</td></tr></tfoot>
    </table></div>}</section>;
}

export function MealCardPanel({rows}:{rows:MealCardSummary[]}){
  if(rows.length===0) return null;
  return <section className="op-panel"><div className="op-panel-head"><h2>Yemek kartı dağılımı</h2><small>Komisyon tahminidir</small></div><div className="op-report-rows">
    {rows.map(r=><div key={r.Ad}><span>{r.Ad}<small>Tahmini komisyon {money(r.TahminiKomisyon)}</small></span><strong>{money(r.Tutar)}</strong></div>)}</div></section>;
}

/** Extra daily panels: delivery collections, couriers, VAT and meal cards. */
export function DailyExtras({collection,couriers,vat,mealCards,refunds}:{collection:DeliveryCollection;couriers:CourierSummary[];vat:VatRow[];mealCards:MealCardSummary[];refunds:number}){
  return <>
    <div className="op-report-columns">
      <section className="op-panel"><div className="op-panel-head"><h2>Paket tahsilatı</h2><small>Yönetici doğruladığında kasaya girer</small></div><div className="op-report-rows">
        <div><span>Nakit (kasaya eklenir)</span><strong>{money(collection.Nakit)}</strong></div>
        <div><span>Kapıda kart</span><strong>{money(collection.Kart)}</strong></div>
        <div><span>Çevrim içi ödenmiş</span><strong>{money(collection.Online)}</strong></div>
        <div><span>Tahsilatı bekleyen<small>{collection.BekleyenSayisi} teslimat, tüm günler</small></span><strong>{money(collection.Bekleyen)}</strong></div>
        {refunds>0&&<div><span>Bugün yapılan iadeler<small>Satıştan ve tahsilattan düşülür</small></span><strong>-{money(refunds)}</strong></div>}
      </div></section>
      <section className="op-panel"><div className="op-panel-head"><h2>Kurye hesabı</h2></div>{couriers.length===0?<div className="op-inline-empty">Bu tarihte teslim edilen paket yok.</div>:
        <div className="op-report-rows">{couriers.map(c=><div key={`${c.KuryeKayitNo}-${c.Kurye}`}><span>{c.Kurye}<small>{c.TeslimSayisi} teslimat · bekleyen {money(c.Bekleyen)}</small></span><strong>{money(c.TahsilEdilen)} / {money(c.TeslimTutari)}</strong></div>)}</div>}</section>
    </div>
    <div className="op-report-columns"><VatTable rows={vat} note="Masa ve teslim edilen paketler, iadeler hariç"/><MealCardPanel rows={mealCards}/></div>
  </>;
}

function monthStart(){const d=new Date();return localDate(new Date(d.getFullYear(),d.getMonth(),1));}

function RangeHead({title,text,start,end,setStart,setEnd,tabs}:{title:string;text:string;start:string;end:string;setStart:(v:string)=>void;setEnd:(v:string)=>void;tabs:ReactNode}){
  return <><header className="op-page-head"><div><h1>{title}</h1><p>{text}</p></div><div className="op-toolbar-row">
    <label className="op-date-field">Başlangıç <input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
    <label className="op-date-field">Bitiş <input type="date" value={end} min={start} max={localDate()} onChange={e=>setEnd(e.target.value)}/></label></div></header>{tabs}</>;
}

export function PeriodReportView({tabs}:{tabs:ReactNode}){
  const [start,setStart]=useState(monthStart);
  const [end,setEnd]=useState(()=>localDate());
  const report=useQuery({queryKey:['period-report',start,end],queryFn:()=>api<PeriodReport>(`/raporlar/donem?baslangic=${start}&bitis=${end}`),enabled:!!start&&!!end});
  const data=report.data;
  return <section className="op-page op-report" aria-label="Dönem raporu">
    <RangeHead title="Dönem raporu" text="Ay sonu ve dönem toplamları. Her gün işletme günü başlangıç saatine göre hesaplanır; en fazla 62 gün." start={start} end={end} setStart={setStart} setEnd={setEnd} tabs={tabs}/>
    <ErrorBox error={report.error} retry={()=>void report.refetch()}/>
    {report.isPending?<Loading/>:data&&<div className="op-stack">
      <div className="op-report-lead"><div><span>Toplam satış</span><strong>{money(data.Toplam.ToplamSatis)}</strong><small>{data.Toplam.AdisyonSayisi} adisyon</small></div><div><span>Masa / paket</span><strong>{money(data.Toplam.MasaSatis)}</strong><small>Paket {money(data.Toplam.PaketSatis)}</small></div><div><span>İptal / zayi / ikram / iade</span><strong>{money(data.Toplam.Iptal+data.Toplam.Zayi+data.Toplam.Ikram)}</strong><small>İade {money(data.Toplam.Iade)}</small></div></div>
      <section className="op-panel"><div className="op-panel-head"><h2>Günlere göre</h2><small>{data.Gunler.filter(d=>d.VardiyaKapali).length} / {data.Gunler.length} gün vardiyası kapalı</small></div><div className="op-table-wrap"><table className="op-data-table">
        <thead><tr><th>Gün</th><th className="num">Adisyon</th><th className="num">Masa</th><th className="num">Paket</th><th className="num">İade</th><th className="num">Toplam</th><th className="num">Nakit</th><th className="num">Kart</th><th className="num">Yemek k.</th><th className="num">Cari</th><th className="num">İptal</th><th className="num">Zayi</th><th></th></tr></thead>
        <tbody>{data.Gunler.map(d=><tr key={d.Tarih}><td>{new Date(`${d.Tarih}T12:00:00`).toLocaleDateString('tr-TR',{weekday:'short',day:'2-digit',month:'2-digit'})}</td><td className="num">{d.AdisyonSayisi}</td><td className="num">{money(d.MasaSatis)}</td><td className="num">{money(d.PaketSatis)}</td><td className="num">{d.Iade?money(-d.Iade):'—'}</td><td className="num"><strong>{money(d.ToplamSatis)}</strong></td><td className="num">{money(d.Nakit)}</td><td className="num">{money(d.Banka)}</td><td className="num">{money(d.YemekKarti)}</td><td className="num">{money(d.Cari)}</td><td className="num">{money(d.Iptal)}</td><td className="num">{money(d.Zayi)}</td><td>{d.VardiyaKapali&&<span className="op-badge is-success">Kapalı</span>}</td></tr>)}</tbody>
        <tfoot><tr><td>Toplam</td><td className="num">{data.Toplam.AdisyonSayisi}</td><td className="num">{money(data.Toplam.MasaSatis)}</td><td className="num">{money(data.Toplam.PaketSatis)}</td><td className="num">{money(-data.Toplam.Iade)}</td><td className="num">{money(data.Toplam.ToplamSatis)}</td><td className="num">{money(data.Toplam.Nakit)}</td><td className="num">{money(data.Toplam.Banka)}</td><td className="num">{money(data.Toplam.YemekKarti)}</td><td className="num">{money(data.Toplam.Cari)}</td><td className="num">{money(data.Toplam.Iptal)}</td><td className="num">{money(data.Toplam.Zayi)}</td><td></td></tr></tfoot>
      </table></div></section>
      <div className="op-report-columns"><VatTable rows={data.KdvDokumu} note="İadeler hariç"/><MealCardPanel rows={data.YemekKartiDagilimi}/></div>
      <section className="op-panel"><div className="op-panel-head"><h2>En çok ciro yapan ürünler</h2></div>{data.EnCokSatan.length?<div className="op-report-rows">{data.EnCokSatan.map(p=><div key={p.StokAdi}><span>{p.StokAdi}<small>{p.ToplamMiktar} adet</small></span><strong>{money(p.ToplamTutar)}</strong></div>)}</div>:<div className="op-inline-empty">Bu aralıkta masa satışı yok.</div>}</section>
    </div>}
  </section>;
}

export function StaffReportView({tabs}:{tabs:ReactNode}){
  const [start,setStart]=useState(monthStart);
  const [end,setEnd]=useState(()=>localDate());
  const report=useQuery({queryKey:['staff-report',start,end],queryFn:()=>api<StaffReport>(`/raporlar/personel?baslangic=${start}&bitis=${end}`),enabled:!!start&&!!end});
  const rows=report.data?.Satirlar??[];
  return <section className="op-page op-report" aria-label="Personel raporu">
    <RangeHead title="Personel raporu" text="Satış, ürünü giren personele; tahsilat ve iade işlemi yapan personele yazılır. İptal, zayi ve ikram işlem kayıtlarından gelir." start={start} end={end} setStart={setStart} setEnd={setEnd} tabs={tabs}/>
    <ErrorBox error={report.error} retry={()=>void report.refetch()}/>
    {report.isPending?<Loading/>:rows.length===0?<Empty>Bu aralıkta personel işlemi yok.</Empty>:<section className="op-panel"><div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Personel</th><th className="num">Açtığı adisyon</th><th className="num">Ürün adedi</th><th className="num">Satış</th><th className="num">İptal</th><th className="num">Zayi</th><th className="num">İkram</th><th className="num">Tahsilat</th><th className="num">İade</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.PersonelId}><td><strong>{r.PersonelAdi}</strong><small>{r.Rol==='Admin'?'Yönetici':r.Rol??'—'}</small></td><td className="num">{r.AcilanAdisyon}</td><td className="num">{r.UrunAdedi}</td><td className="num">{money(r.SatisTutari)}</td>
        <td className="num">{money(r.IptalTutari)}<small>{r.IptalSayisi} kez</small></td><td className="num">{money(r.ZayiTutari)}</td><td className="num">{money(r.IkramTutari)}</td><td className="num">{money(r.TahsilatTutari)}</td><td className="num">{money(r.IadeTutari)}</td></tr>)}</tbody>
    </table></div></section>}
  </section>;
}
