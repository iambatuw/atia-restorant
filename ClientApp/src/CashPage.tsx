import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Download,HandCoins,Landmark,Pencil,Plus,Wallet} from 'lucide-react';
import {api,localDate,money,toCents} from './api';
import type {Account,AccountStatement,CashMovement,FullReport} from './types';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import {downloadCsv} from './csv';
import './Extensions.css';

const inCategories=['Kasa açılışı','Bozuk para','Diğer giriş'];
const outCategories=['Masraf','Tedarikçi ödemesi','Bankaya yatırılan','Personel avansı','Diğer çıkış'];

export default function CashPage(){
  const [tab,setTab]=useState<'kasa'|'cari'>('kasa');
  return <section className="op-page" aria-label="Kasa ve cari">
    <header className="op-page-head"><div><h1>Kasa ve cari</h1><p>Kasaya giren ve çıkan para ile veresiye (cari) müşteri hesapları</p></div></header>
    <div className="op-tabs" role="group" aria-label="Kasa bölümleri">
      <button aria-pressed={tab==='kasa'} onClick={()=>setTab('kasa')}>Kasa hareketleri</button>
      <button aria-pressed={tab==='cari'} onClick={()=>setTab('cari')}>Cari hesaplar</button>
    </div>
    {tab==='kasa'?<Till/>:<Accounts/>}
  </section>;
}

function Till(){
  const [date,setDate]=useState(()=>localDate());
  const [add,setAdd]=useState<boolean|null>(null);
  const report=useQuery({queryKey:['report',date],queryFn:()=>api<FullReport>(`/raporlar/gunluk?tarih=${date}`)});
  const moves=report.data?.KasaHareketleri??[];
  const r=report.data;
  return <div className="op-stack">
    <div className="op-toolbar-row"><label className="op-date-field">İşletme tarihi <input type="date" value={date} max={localDate()} onChange={e=>setDate(e.target.value)}/></label>
      <button className="secondary" onClick={()=>setAdd(true)}><Plus size={16}/> Kasaya para girişi</button>
      <button className="primary" onClick={()=>setAdd(false)}><Wallet size={16}/> Kasadan çıkış (masraf)</button>
      <button className="secondary" disabled={!moves.length} onClick={()=>downloadCsv(`kasa-${date}`,['Saat','Tür','Kategori','Tutar','Açıklama','Personel'],
        moves.map(m=>[new Date(m.Tarih).toLocaleTimeString('tr-TR'),m.Giris?'Giriş':'Çıkış',m.Kategori,m.Giris?m.Tutar:-m.Tutar,m.Aciklama,m.PersonelAdi]))}><Download size={15}/> CSV</button></div>
    <ErrorBox error={report.error} retry={()=>void report.refetch()}/>
    {report.isPending?<Loading/>:r&&<>
      <section className="op-panel"><div className="op-panel-head"><h2>Beklenen kasa nakdi</h2><strong>{money(r.BeklenenKasaNakdi)}</strong></div><div className="op-report-rows">
        <div><span>Masa nakit tahsilatı<small>Düzeltme ve iadeler dahil</small></span><strong>{money(r.Mutabakat.Nakit)}</strong></div>
        <div><span>Paket nakit tahsilatı</span><strong>{money(r.PaketTahsilat.Nakit)}</strong></div>
        <div><span>Cari tahsilatı (nakit)</span><strong>{money(r.CariTahsilatNakit??0)}</strong></div>
        <div><span>Kasaya giriş</span><strong>{money(r.KasaGiris??0)}</strong></div>
        <div><span>Kasadan çıkış</span><strong>-{money(r.KasaCikis??0)}</strong></div>
      </div></section>
      <section className="op-panel"><div className="op-panel-head"><h2>Kasa hareketleri</h2></div>{moves.length===0?<div className="op-inline-empty">Bu tarihte kasa hareketi yok.</div>:
        <div className="op-table-wrap"><table className="op-data-table"><thead><tr><th>Saat</th><th>Kategori</th><th>Açıklama</th><th className="num">Tutar</th></tr></thead>
          <tbody>{moves.map(m=><tr key={m.KayitNo}><td>{new Date(m.Tarih).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</td><td>{m.Kategori}<small>{m.Giris?'Giriş':'Çıkış'}</small></td><td>{m.Aciklama}<small>{m.PersonelAdi}</small></td><td className="num">{m.Giris?'+':'-'}{money(m.Tutar)}</td></tr>)}</tbody></table></div>}</section>
    </>}
    {add!==null&&<CashForm incoming={add} close={()=>setAdd(null)}/>}
  </div>;
}

function CashForm({incoming,close}:{incoming:boolean;close:()=>void}){
  const client=useQueryClient();
  const categories=incoming?inCategories:outCategories;
  const [category,setCategory]=useState(categories[0]);
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const cents=toCents(amount);
  const save=useMutation({mutationFn:()=>api<CashMovement>('/kasa/hareketler',{method:'POST',body:JSON.stringify({Giris:incoming,Kategori:category,Tutar:cents!/100,Aciklama:note.trim()})}),
    onSuccess:async()=>{await client.invalidateQueries();close();}});
  return <Modal title={incoming?'Kasaya para girişi':'Kasadan çıkış'} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <div className="op-chip-row" role="group" aria-label="Kategori">{categories.map(c=><button type="button" key={c} className="op-chip" aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="form-row"><label>Tutar<input autoFocus required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/></label>
      <label>Açıklama<input required maxLength={200} value={note} onChange={e=>setNote(e.target.value)} placeholder={incoming?'ör. sabah bozuk para':'ör. ekmek, tüp'}/></label></div>
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!cents||!note.trim()||save.isPending}>{save.isPending?'Kaydediliyor…':'Kaydet'}</button></div>
  </form></Modal>;
}

function Accounts(){
  const [search,setSearch]=useState('');
  const [edit,setEdit]=useState<Account|true|null>(null);
  const [open,setOpen]=useState<number|null>(null);
  const accounts=useQuery({queryKey:['accounts',search.trim()],queryFn:()=>api<Account[]>(`/cari${search.trim()?`?ara=${encodeURIComponent(search.trim())}`:''}`)});
  const list=accounts.data??[];
  return <div className="op-stack">
    <div className="op-toolbar-row"><label className="op-grow">Ara<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Unvan, telefon veya vergi no"/></label>
      <button className="primary" onClick={()=>setEdit(true)}><Plus size={16}/> Cari hesap aç</button></div>
    <ErrorBox error={accounts.error} retry={()=>void accounts.refetch()}/>
    {accounts.isPending?<Loading/>:list.length===0?<Empty><Landmark size={28}/><h2>Cari hesap yok</h2><p>Veresiye çalışılan firma veya müşteriler için hesap açın.</p></Empty>:
    <section className="op-panel"><div className="op-panel-head"><h2>Toplam alacak</h2><strong>{money(list.reduce((s,a)=>s+Math.max(0,a.Bakiye),0))}</strong></div><div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>Unvan</th><th>Telefon</th><th className="num">Limit</th><th className="num">Bakiye</th><th></th></tr></thead>
      <tbody>{list.map(a=><tr key={a.KayitNo}><td><strong>{a.Unvan}</strong>{!a.Aktif&&<small>Pasif</small>}{a.VergiNo&&<small>VKN {a.VergiNo}</small>}</td><td>{a.Telefon??'—'}</td>
        <td className="num">{a.KrediLimiti?money(a.KrediLimiti):'Limitsiz'}</td>
        <td className="num"><strong>{money(a.Bakiye)}</strong>{a.KrediLimiti>0&&a.Bakiye>=a.KrediLimiti*0.9&&<span className="op-badge is-warning">Limite yakın</span>}</td>
        <td className="num"><button className="secondary" onClick={()=>setOpen(a.KayitNo)}><HandCoins size={15}/> Ekstre / tahsilat</button> <button className="secondary" aria-label={`${a.Unvan} düzenle`} onClick={()=>setEdit(a)}><Pencil size={15}/></button></td></tr>)}</tbody>
    </table></div></section>}
    {edit&&<AccountForm account={edit===true?undefined:edit} close={()=>setEdit(null)}/>}
    {open!==null&&<Statement id={open} close={()=>setOpen(null)}/>}
  </div>;
}

function AccountForm({account,close}:{account?:Account;close:()=>void}){
  const client=useQueryClient();
  const [form,setForm]=useState({Unvan:account?.Unvan??'',Telefon:account?.Telefon??'',VergiDairesi:account?.VergiDairesi??'',VergiNo:account?.VergiNo??'',Adres:account?.Adres??'',limit:String(account?.KrediLimiti??0),Aktif:account?.Aktif??true});
  const set=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[key]:e.target.value}));
  const limit=toCents(form.limit);
  const taxValid=!form.VergiNo||/^\d{10,11}$/.test(form.VergiNo);
  const save=useMutation({mutationFn:()=>api(account?`/cari/${account.KayitNo}`:'/cari',{method:account?'PUT':'POST',body:JSON.stringify({Unvan:form.Unvan.trim(),Telefon:form.Telefon,
    VergiDairesi:form.VergiDairesi,VergiNo:form.VergiNo,Adres:form.Adres,KrediLimiti:limit!/100,Aktif:form.Aktif})}),onSuccess:async()=>{await client.invalidateQueries({queryKey:['accounts']});close();}});
  return <Modal title={account?`${account.Unvan} düzenle`:'Yeni cari hesap'} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <div className="form-row"><label>Unvan / ad soyad<input autoFocus required maxLength={120} value={form.Unvan} onChange={set('Unvan')}/></label><label>Telefon<input maxLength={30} value={form.Telefon} onChange={set('Telefon')}/></label></div>
    <div className="form-row"><label>Vergi dairesi<input maxLength={80} value={form.VergiDairesi} onChange={set('VergiDairesi')}/></label><label>Vergi / TC kimlik no<input inputMode="numeric" maxLength={11} value={form.VergiNo} onChange={set('VergiNo')}/></label></div>
    <div className="form-row"><label>Adres<input maxLength={300} value={form.Adres} onChange={set('Adres')}/></label><label>Kredi limiti (0 = limitsiz)<input inputMode="decimal" value={form.limit} onChange={set('limit')}/></label></div>
    <label className="op-check-label"><input type="checkbox" checked={form.Aktif} onChange={e=>setForm(f=>({...f,Aktif:e.target.checked}))}/> Hesap aktif</label>
    {!taxValid&&<p className="error-text" role="status">Vergi numarası 10, TC kimlik numarası 11 haneli olmalı.</p>}
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!form.Unvan.trim()||limit===null||!taxValid||save.isPending}>Kaydet</button></div>
  </form></Modal>;
}

function Statement({id,close}:{id:number;close:()=>void}){
  const client=useQueryClient();
  const statement=useQuery({queryKey:['account',id],queryFn:()=>api<AccountStatement>(`/cari/${id}/ekstre`)});
  const [cash,setCash]=useState('');
  const [card,setCard]=useState('');
  const [note,setNote]=useState('');
  const c1=cash.trim()?toCents(cash):0, c2=card.trim()?toCents(card):0;
  const collect=useMutation({mutationFn:()=>api(`/cari/${id}/tahsilat`,{method:'POST',body:JSON.stringify({Nakit:(c1??0)/100,Banka:(c2??0)/100,Aciklama:note.trim()||null})}),
    onSuccess:async()=>{setCash('');setCard('');setNote('');await client.invalidateQueries();}});
  const data=statement.data;
  return <Modal title={data?data.Hesap.Unvan:'Cari ekstre'} onClose={close}>
    <ErrorBox error={statement.error} retry={()=>void statement.refetch()}/>
    {!data?<Loading/>:<div className="op-stack">
      <div className="payment-breakdown-card"><div className="payment-breakdown-row highlight"><span>Güncel bakiye (müşterinin borcu)</span><strong>{money(data.Hesap.Bakiye)}</strong></div></div>
      <section className="op-form-card"><h2>Tahsilat al</h2><div className="craft-form">
        <div className="form-row"><label>Nakit<input inputMode="decimal" value={cash} onChange={e=>setCash(e.target.value)} placeholder="0,00"/></label><label>Kart / havale<input inputMode="decimal" value={card} onChange={e=>setCard(e.target.value)} placeholder="0,00"/></label></div>
        <label>Açıklama<input maxLength={200} value={note} onChange={e=>setNote(e.target.value)} placeholder="ör. ay sonu ödemesi"/></label>
        <ErrorBox error={collect.error}/>
        <div className="dialog-actions"><button className="primary" type="button" disabled={c1===null||c2===null||(c1??0)+(c2??0)<=0||collect.isPending} onClick={()=>collect.mutate()}>{money(((c1??0)+(c2??0))/100)} tahsil et</button></div></div></section>
      <div className="op-toolbar-row"><button className="secondary" disabled={!data.Hareketler.length} onClick={()=>downloadCsv(`cari-${data.Hesap.Unvan}`,['Tarih','Tür','Adisyon','Açıklama','Borç','Alacak','Bakiye'],
        data.Hareketler.map(m=>[new Date(m.Tarih).toLocaleString('tr-TR'),m.Tip,m.AdisyonNo,m.Aciklama,m.Borc,m.Alacak,m.BakiyeSonrasi]))}><Download size={15}/> Ekstreyi CSV indir</button></div>
      {data.Hareketler.length===0?<p className="op-note">Henüz hareket yok.</p>:<div className="op-table-wrap"><table className="op-data-table">
        <thead><tr><th>Tarih</th><th>Tür</th><th className="num">Borç</th><th className="num">Alacak</th><th className="num">Bakiye</th></tr></thead>
        <tbody>{data.Hareketler.map(m=><tr key={m.KayitNo}><td>{new Date(m.Tarih).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}<small>{m.AdisyonNo?`Adisyon #${m.AdisyonNo} · `:''}{m.Aciklama}</small></td>
          <td>{m.Tip}</td><td className="num">{m.Borc?money(m.Borc):''}</td><td className="num">{m.Alacak?money(m.Alacak):''}</td><td className="num">{money(m.BakiyeSonrasi)}</td></tr>)}</tbody></table></div>}
    </div>}
  </Modal>;
}
