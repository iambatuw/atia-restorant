import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Printer,ReceiptText,RotateCcw,Shuffle} from 'lucide-react';
import {api,money,toCents} from './api';
import type {Account,FullSettings,ReceiptHistoryDetail,ReceiptSummary,Report} from './types';
import {BillPrint} from './Barcode';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import './Extensions.css';
import {downloadCsv} from './csv';

export default function ReceiptsPage(){
  const today=useQuery({queryKey:['report','today'],queryFn:()=>api<Report>('/raporlar/gunluk')});
  const [date,setDate]=useState('');
  const [includeOpen,setIncludeOpen]=useState(false);
  const [selected,setSelected]=useState<number|null>(null);
  const day=date||today.data?.IsletmeTarihi||'';
  const list=useQuery({queryKey:['receipts',day,includeOpen],enabled:!!day,
    queryFn:()=>api<ReceiptSummary[]>(`/adisyonlar?tarih=${day}${includeOpen?'&acik=true':''}`),refetchInterval:20000});
  const rows=list.data??[];
  const closed=rows.filter(r=>r.Kapali&&!r.Birlesti);
  return <section className="op-page" aria-label="Adisyonlar">
    <header className="op-page-head"><div><h1>Adisyonlar</h1><p>Kapanmış adisyonları inceleyin, ödeme şeklini düzeltin, iade kaydedin veya fişi yeniden yazdırın.</p></div>
      <div className="op-toolbar-row"><label className="op-date-field">İşletme tarihi <input type="date" value={day} onChange={e=>setDate(e.target.value)}/></label>
        <label className="op-check-label"><input type="checkbox" checked={includeOpen} onChange={e=>setIncludeOpen(e.target.checked)}/> Açık adisyonları da göster</label></div></header>
    <ErrorBox error={today.error||list.error} retry={()=>void list.refetch()}/>
    {list.isPending&&day?<Loading/>:rows.length===0?<Empty><ReceiptText size={28}/><h2>Bu tarihte adisyon yok</h2><p>Başka bir işletme günü seçin.</p></Empty>:<>
    <div className="op-toolbar-row"><button className="secondary" onClick={()=>downloadCsv(`adisyonlar-${day}`,['No','Masa','Personel','Açılış','Kapanış','Durum','Toplam','İndirim','Nakit','Kart','Yemek kartı','Cari','İade'],
      rows.map(r=>[r.KayitNo,r.MasaAdi,r.PersonelAdi,r.AcilisTarihi&&new Date(r.AcilisTarihi).toLocaleString('tr-TR'),r.KapanisTarihi&&new Date(r.KapanisTarihi).toLocaleString('tr-TR'),!r.Kapali?'Açık':r.Birlesti?'Birleşti':'Kapalı',r.GenelToplam,r.Indirim,r.Nakit,r.Banka,r.YemekKarti,r.Cari,r.Iade]))}>CSV indir</button></div>
    <section className="op-panel"><div className="op-panel-head"><h2>{closed.length} kapanan adisyon</h2><small>Toplam {money(closed.reduce((s,r)=>s+r.GenelToplam-r.Indirim-r.Iade,0))}</small></div>
      <div className="op-table-wrap"><table className="op-data-table">
      <thead><tr><th>No</th><th>Masa</th><th>Kapanış</th><th>Ödeme</th><th className="num">Tutar</th><th></th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.KayitNo} className="is-clickable" onClick={()=>setSelected(r.KayitNo)}>
        <td><button type="button" className="op-row-button" onClick={e=>{e.stopPropagation();setSelected(r.KayitNo);}}>#{r.KayitNo}</button></td>
        <td>{r.MasaAdi}<small>{r.PersonelAdi} · {r.UrunSayisi} ürün</small></td>
        <td>{r.KapanisTarihi?new Date(r.KapanisTarihi).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
        <td><small>{[r.Nakit&&`Nakit ${money(r.Nakit)}`,r.Banka&&`Kart ${money(r.Banka)}`,r.YemekKarti&&`Yemek ${money(r.YemekKarti)}`,r.Cari&&`Cari ${money(r.Cari)}`].filter(Boolean).join(' · ')||'—'}</small></td>
        <td className="num">{money(r.GenelToplam-r.Indirim)}{r.Iade>0&&<small>İade {money(r.Iade)}</small>}</td>
        <td>{!r.Kapali?<span className="op-badge is-warning">Açık</span>:r.Birlesti?<span className="op-badge">Birleşti</span>:r.Iade>0?<span className="op-badge is-danger">İadeli</span>:null}</td>
      </tr>)}</tbody></table></div></section></>}
    {selected!==null&&<ReceiptDetail id={selected} close={()=>setSelected(null)}/>}
  </section>;
}

function ReceiptDetail({id,close}:{id:number;close:()=>void}){
  const client=useQueryClient();
  const detail=useQuery({queryKey:['receipt-detail',id],queryFn:()=>api<ReceiptHistoryDetail>(`/adisyonlar/${id}`)});
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const [action,setAction]=useState<'correct'|'refund'|null>(null);
  const [printing,setPrinting]=useState(false);
  const printMark=useMutation({mutationFn:()=>api(`/adisyonlar/${id}/yazdirildi`,{method:'POST'}),onSuccess:()=>{setPrinting(true);void client.invalidateQueries({queryKey:['receipt-detail',id]});}});
  const data=detail.data;
  const r=data?.Adisyon;
  return <Modal title={`Adisyon #${id}`} onClose={close}>
    <ErrorBox error={detail.error||printMark.error} retry={()=>void detail.refetch()}/>
    {detail.isPending||!r||!data?<Loading/>:<div className="op-stack">
      <p className="op-note">{r.MasaAdi} · {r.PersonelAdi} · açılış {r.KayitTarihi?new Date(r.KayitTarihi).toLocaleString('tr-TR'):'—'}{data.KapanisTarihi?` · kapanış ${new Date(data.KapanisTarihi).toLocaleString('tr-TR')}`:' · açık'}{data.Birlesti?' · başka adisyonla birleştirildi':''}</p>
      <table className="op-data-table"><tbody>{r.Detaylar.map(line=><tr key={line.KayitNo}>
        <td>{line.Miktar} × {line.StokAdi}{line.PorsiyonAdi?` · ${line.PorsiyonAdi}`:''}{line.SecimMetni&&<small>{line.SecimMetni}</small>}{line.SatirAciklama&&<small>Not: {line.SatirAciklama}</small>}</td>
        <td className="num">{line.Ikram?'İkram':money(line.SatirTutari)}<small>KDV %{line.KdvOrani}</small></td></tr>)}</tbody>
        <tfoot><tr><td>Toplam{(r.IndirimToplam??0)>0?` (indirim ${money(r.IndirimToplam)})`:''}</td><td className="num">{money(r.GenelToplam-(r.IndirimToplam??0))}</td></tr></tfoot></table>
      <div className="op-report-rows">
        <div><span>Nakit / kart / yemek kartı / cari</span><strong>{[r.NakitToplam,r.BankaToplam,r.YemekKartiToplam,r.CariToplam].map(v=>money(v??0)).join(' / ')}</strong></div>
        {r.YemekKartiAdi&&<div><span>Yemek kartı türü</span><strong>{r.YemekKartiAdi}</strong></div>}
        {r.KdvDokumu.map(v=><div key={v.Oran}><span>KDV %{v.Oran} · matrah {money(v.Matrah)}</span><strong>{money(v.Kdv)}</strong></div>)}
        {r.Iadeler.map(i=><div key={i.KayitNo}><span>İade · {new Date(i.Tarih).toLocaleString('tr-TR')} · {i.PersonelAdi}<small>{i.Gerekce}</small></span><strong>-{money(i.Toplam)}</strong></div>)}
      </div>
      {data.Islemler.length>0&&<details><summary>İşlem geçmişi ({data.Islemler.length})</summary><div className="op-audit-list">{data.Islemler.map(item=><div className="op-audit-row" key={item.KayitNo}>
        <time dateTime={item.Tarih}>{new Date(item.Tarih).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</time><div><strong>{item.Islem}</strong><span>{item.Aciklama}</span></div><span>{item.PersonelAdi}</span>{item.Tutar!==0&&<b>{money(item.Tutar)}</b>}</div>)}</div></details>}
      {!data.Duzeltilebilir&&r.Kapali&&<p className="op-note">Ödeme düzeltmesi yalnızca bugünkü işletme gününde kapanmış ve iade görmemiş adisyonlarda yapılabilir. Önceki günler için iade kaydı kullanın.</p>}
      <div className="dialog-actions">
        <button type="button" disabled={printMark.isPending} onClick={()=>printMark.mutate()}><Printer size={15}/> Yeniden yazdır</button>
        {data.Duzeltilebilir&&<button type="button" onClick={()=>setAction('correct')}><Shuffle size={15}/> Ödeme şeklini düzelt</button>}
        {data.IadeEdilebilir&&<button type="button" className="danger" onClick={()=>setAction('refund')}><RotateCcw size={15}/> İade kaydet</button>}
      </div>
      {action&&<PaymentEdit detail={data} mode={action} mealCards={settings.data?.YemekKartlari??[]} close={()=>setAction(null)}/>}
      {printing&&<BillPrint receipt={r} store={settings.data?.Isletme} onDone={()=>setPrinting(false)}/>}
    </div>}
  </Modal>;
}

function PaymentEdit({detail,mode,mealCards,close}:{detail:ReceiptHistoryDetail;mode:'correct'|'refund';mealCards:FullSettings['YemekKartlari'];close:()=>void}){
  const client=useQueryClient();
  const r=detail.Adisyon;
  const refunded=(key:'Nakit'|'Banka'|'YemekKarti'|'Cari')=>r.Iadeler.reduce((s,i)=>s+i[key],0);
  const start=mode==='correct'?{cash:r.NakitToplam??0,card:r.BankaToplam??0,meal:r.YemekKartiToplam??0,account:r.CariToplam??0}:{cash:0,card:0,meal:0,account:0};
  const [cash,setCash]=useState(String(start.cash));
  const [card,setCard]=useState(String(start.card));
  const [meal,setMeal]=useState(String(start.meal));
  const [account,setAccount]=useState(String(start.account));
  const [mealCard,setMealCard]=useState(String(r.YemekKartiKayitNo??''));
  const [reason,setReason]=useState('');
  const cents=[cash,card,meal,account].map(toCents);
  const parsed=cents.every(c=>c!==null);
  const total=parsed?cents.reduce((s,c)=>s!+c!,0)!:0;
  const paidTotal=Math.round(((r.NakitToplam??0)+(r.BankaToplam??0)+(r.YemekKartiToplam??0)+(r.CariToplam??0))*100);
  const limits=[(r.NakitToplam??0)-refunded('Nakit'),(r.BankaToplam??0)-refunded('Banka'),(r.YemekKartiToplam??0)-refunded('YemekKarti'),(r.CariToplam??0)-refunded('Cari')].map(v=>Math.round(v*100));
  const valid=parsed&&reason.trim().length>0&&(mode==='correct'?total===paidTotal:total>0&&cents.every((c,i)=>c!<=limits[i]));
  const active=mealCards.filter(c=>c.Aktif);
  const accounts=useQuery({queryKey:['accounts',''],queryFn:()=>api<Account[]>('/cari')});
  const activeAccounts=(accounts.data??[]).filter(a=>a.Aktif);
  const [accountId,setAccountId]=useState(String(r.CariHesapKayitNo??''));
  const needsCard=mode==='correct'&&(((cents[2]??0)>0&&active.length>0&&!mealCard)||((cents[3]??0)>0&&activeAccounts.length>0&&!accountId));
  const save=useMutation({mutationFn:()=>api(`/adisyonlar/${r.KayitNo}/${mode==='correct'?'odeme-duzelt':'iade'}`,{method:'POST',body:JSON.stringify({
      Nakit:cents[0]!/100,Banka:cents[1]!/100,YemekKarti:cents[2]!/100,Cari:cents[3]!/100,Gerekce:reason.trim(),
      ...(mode==='correct'?{YemekKartiKayitNo:(cents[2]??0)>0&&mealCard?Number(mealCard):null,CariHesapKayitNo:(cents[3]??0)>0&&accountId?Number(accountId):null}:{})})}),
    onSuccess:async()=>{await client.invalidateQueries();close();}});
  const field=(label:string,value:string,set:(v:string)=>void,limit:number)=><label>{label}{mode==='refund'&&<small> en fazla {money(limit/100)}</small>}<input inputMode="decimal" value={value} onChange={e=>set(e.target.value)}/></label>;
  return <section className="op-form-card" aria-label={mode==='correct'?'Ödeme düzeltme':'İade'}>
    <h2>{mode==='correct'?'Ödeme şeklini düzelt':'İade kaydet'}</h2>
    <p>{mode==='correct'?`Toplam tahsilat ${money(paidTotal/100)} aynı kalmalı; yalnızca dağılım değişir.`:'İade tutarı kasaya ve günlük rapora eksi olarak işlenir. Kart iadesi fiziksel POS’ta ayrıca yapılmalıdır.'}</p>
    <div className="craft-form">
      <div className="form-row">{field('Nakit',cash,setCash,limits[0])}{field('Banka kartı',card,setCard,limits[1])}</div>
      <div className="form-row">{field('Yemek kartı',meal,setMeal,limits[2])}{field('Cari',account,setAccount,limits[3])}</div>
      {mode==='correct'&&(cents[3]??0)>0&&activeAccounts.length>0&&<label>Cari hesap<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Hesap seçin</option>{activeAccounts.map(a=><option key={a.KayitNo} value={a.KayitNo}>{a.Unvan}</option>)}</select></label>}
      {mode==='correct'&&(cents[2]??0)>0&&active.length>0&&<label>Yemek kartı türü<select value={mealCard} onChange={e=>setMealCard(e.target.value)}><option value="">Kart seçin</option>{active.map(c=><option key={c.KayitNo} value={c.KayitNo}>{c.Ad}</option>)}</select></label>}
      <label>Gerekçe<input required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder={mode==='correct'?'ör. kartla ödemişti, nakit girildi':'ör. ürün soğuk geldi'}/></label>
      {mode==='correct'&&parsed&&total!==paidTotal&&<p className="error-text" role="status">Girilen toplam {money(total/100)}; {money(paidTotal/100)} olmalı.</p>}
      <ErrorBox error={save.error}/>
      <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button type="button" className={mode==='refund'?'danger':'primary'} disabled={!valid||needsCard||save.isPending} onClick={()=>save.mutate()}>{save.isPending?'Kaydediliyor…':mode==='correct'?'Düzeltmeyi kaydet':`${money(total/100)} iade et`}</button></div>
    </div>
  </section>;
}
