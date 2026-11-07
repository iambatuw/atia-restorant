import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,Plus,Trash2} from 'lucide-react';
import {api,localDate,money} from './api';
import type {Report,Reservation,Table} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';

export default function Management({page}:{page:'raporlar'|'rezervasyonlar'}){return page==='raporlar'?<Reports/>:<Reservations/>;}

function Reports(){
  const [date,setDate]=useState(localDate());
  const report=useQuery({queryKey:['report',date],queryFn:()=>api<Report>(`/raporlar/gunluk?tarih=${date}`),refetchInterval:15000});
  const data=report.data;
  const payments=data?[['Nakit',data.NakitToplam],['Banka kartı',data.BankaToplam],['Yemek kartı',data.YemekKartiToplam],['Cari',data.CariToplam]] as const:[];
  const maxHour=Math.max(1,...(data?.SaatlikCiro.map(hour=>hour.Ciro)??[]));
  return <section className="op-page op-report" aria-label="Günlük rapor">
    <header className="op-page-head"><div><h1>Günlük rapor</h1><p>Satış ve tahsilatın kesinleşen kayıtları</p></div><label className="op-date-field">Tarih <input type="date" value={date} max={localDate()} onChange={e=>setDate(e.target.value)}/></label></header>
    <ErrorBox error={report.error} retry={()=>void report.refetch()}/>
    {report.isPending?<Loading/>:data&&<>
      <div className="op-report-lead"><div><span>Toplam tahsilat</span><strong>{money(data.ToplamCiro)}</strong><small>{data.ToplamAdisyon} kapanan adisyon</small></div><div><span>Açık adisyon</span><strong>{data.AcikAdisyon}</strong><small>Şu anda açık</small></div><div><span>Adisyon ortalaması</span><strong>{money(data.ToplamAdisyon?data.ToplamCiro/data.ToplamAdisyon:0)}</strong><small>Kapanan adisyon başına</small></div></div>
      <div className="op-report-columns"><section className="op-panel"><div className="op-panel-head"><h2>Tahsilat türleri</h2></div><div className="op-report-rows">{payments.map(([name,value])=><div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}{data.IndirimToplam>0&&<div><span>İndirim</span><strong>{money(data.IndirimToplam)}</strong></div>}</div></section>
      <section className="op-panel"><div className="op-panel-head"><h2>En çok satan ürünler</h2></div>{data.EnCokSatan.length?<div className="op-report-rows">{data.EnCokSatan.slice(0,8).map(item=><div key={item.StokAdi}><span>{item.StokAdi}<small>{item.ToplamMiktar} adet</small></span><strong>{money(item.ToplamTutar)}</strong></div>)}</div>:<div className="op-inline-empty">Bu tarihte ürün satışı yok.</div>}</section></div>
      <section className="op-panel op-hour-panel"><div className="op-panel-head"><h2>Saatlik tahsilat</h2></div>{data.SaatlikCiro.length?<div className="op-hours">{data.SaatlikCiro.map(hour=><div key={hour.Saat}><span>{String(hour.Saat).padStart(2,'0')}:00</span><div><i style={{width:`${Math.max(2,hour.Ciro/maxHour*100)}%`}}/></div><strong>{money(hour.Ciro)}</strong></div>)}</div>:<div className="op-inline-empty">Bu tarihte saatlik tahsilat kaydı yok.</div>}</section>
      <p className="op-report-note">Paket servis kayıtları henüz bu tahsilat raporuna dahil değildir.</p>
    </>}
  </section>;
}

function Reservations(){
  const client=useQueryClient();
  const [date,setDate]=useState(localDate());
  const [create,setCreate]=useState(false);
  const [cancel,setCancel]=useState<Reservation|null>(null);
  const list=useQuery({queryKey:['reservations',date],queryFn:()=>api<Reservation[]>(`/rezervasyonlar?tarih=${date}`),refetchInterval:15000});
  const remove=useMutation({mutationFn:(id:number)=>api(`/rezervasyonlar/${id}`,{method:'DELETE'}),onSuccess:async()=>{await client.invalidateQueries();setCancel(null);}});
  return <section className="op-page op-reservations" aria-label="Rezervasyonlar">
    <header className="op-page-head"><div><h1>Rezervasyonlar</h1><p>Rezervasyon kullanan işletmeler için masa kayıtları</p></div><div className="op-reservation-actions"><label className="op-date-field">Tarih <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary" onClick={()=>setCreate(true)}><Plus size={17}/> Yeni rezervasyon</button></div></header>
    <ErrorBox error={list.error} retry={()=>void list.refetch()}/>
    {list.isPending?<Loading/>:list.data?.length?<div className="op-reservation-list"><div className="op-reservation-labels"><span>Saat / misafir</span><span>Masa</span><span>Kişi</span><span>İletişim</span><span></span></div>{list.data.map(item=><div className="op-reservation-row" key={item.KayitNo}><div><strong>{new Date(item.RezervasyonTarihi).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} · {item.MusteriAdi}</strong>{item.Aciklama&&<small>{item.Aciklama}</small>}</div><span>{item.MasaAdi}</span><span>{item.KisiSayisi}</span><span>{item.Telefon||'—'}</span><button className="icon-button" aria-label={`${item.MusteriAdi} rezervasyonunu iptal et`} onClick={()=>setCancel(item)}><Trash2 size={16}/></button></div>)}</div>:<Empty><CalendarDays size={29}/><h2>Bu tarihte rezervasyon yok</h2><p>Gerekirse yeni rezervasyon ekleyebilirsiniz.</p></Empty>}
    {create&&<ReservationForm date={date} close={()=>setCreate(false)}/>}
    {cancel&&<Modal title="Rezervasyonu iptal et" onClose={()=>setCancel(null)}><p><strong>{cancel.MusteriAdi}</strong> için {cancel.MasaAdi} rezervasyonu silinecek.</p><ErrorBox error={remove.error}/><div className="dialog-actions"><button disabled={remove.isPending} onClick={()=>setCancel(null)}>Vazgeç</button><button className="danger" disabled={remove.isPending} onClick={()=>remove.mutate(cancel.KayitNo)}>Rezervasyonu iptal et</button></div></Modal>}
  </section>;
}

function ReservationForm({date,close}:{date:string;close:()=>void}){
  const client=useQueryClient();
  const tables=useQuery({queryKey:['tables'],queryFn:()=>api<Table[]>('/masalar')});
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [time,setTime]=useState(`${date}T19:00`);
  const [table,setTable]=useState('');
  const [people,setPeople]=useState('2');
  const [note,setNote]=useState('');
  const create=useMutation({mutationFn:()=>api('/rezervasyonlar',{method:'POST',body:JSON.stringify({MasaKayitNo:Number(table),MusteriAdi:name.trim(),Telefon:phone.trim(),RezervasyonTarihi:new Date(time).toISOString(),KisiSayisi:Number(people),Aciklama:note.trim()})}),onSuccess:async()=>{await client.invalidateQueries();close();}});
  return <Modal title="Yeni rezervasyon" onClose={()=>{if(!create.isPending)close();}}><form className="craft-form" onSubmit={e=>{e.preventDefault();create.mutate();}}>
    <label>Misafir adı<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="form-row"><label>Masa<select required value={table} onChange={e=>setTable(e.target.value)}><option value="">Masa seçin</option>{tables.data?.filter(t=>!t.BirlesmisMasa).map(t=><option key={t.MasaId} value={t.MasaId}>{t.MasaAdi} ({t.RestorantBolumAdi})</option>)}</select></label><label>Kişi sayısı<input required type="number" min="1" max="30" value={people} onChange={e=>setPeople(e.target.value)}/></label></div>
    <div className="form-row"><label>Tarih ve saat<input required type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Telefon<input type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label></div>
    <label>Not<textarea maxLength={250} value={note} onChange={e=>setNote(e.target.value)}/></label><ErrorBox error={tables.error||create.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" type="submit" disabled={create.isPending||!table}>{create.isPending?'Kaydediliyor…':'Rezervasyonu kaydet'}</button></div>
  </form></Modal>;
}
