import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,Trash2} from 'lucide-react';
import {api} from './api';
import type {Category,DemoStatus,FullSettings,MealCard,Printer,Section,StoreProfile,Table} from './types';
import {ErrorBox,Loading,Modal} from './ui';
import './Extensions.css';

type Tab='genel'|'masalar'|'yazicilar'|'yemek'|'notlar';

export function SettingsPage(){
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const [tab,setTab]=useState<Tab>('genel');
  return <section className="op-page op-settings-page" aria-label="Ayarlar">
    <header className="op-page-head"><div><h1>Ayarlar</h1><p>İşletme bilgisi, masa düzeni, yazıcı yönlendirmesi ve işlem seçenekleri</p></div></header>
    <div className="op-tabs" role="group" aria-label="Ayar bölümleri">
      {([['genel','Genel'],['masalar','Masalar ve bölümler'],['yazicilar','Yazıcılar'],['yemek','Yemek kartları'],['notlar','Hazır notlar']] as const).map(([id,label])=>
        <button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    <ErrorBox error={settings.error} retry={()=>void settings.refetch()}/>
    {settings.isPending?<Loading/>:settings.data&&(tab==='genel'?<General settings={settings.data}/>:tab==='masalar'?<FloorSetup/>:
      tab==='yazicilar'?<Printers key={JSON.stringify(settings.data.Yazicilar)} printers={settings.data.Yazicilar}/>:
      tab==='yemek'?<MealCards key={JSON.stringify(settings.data.YemekKartlari)} cards={settings.data.YemekKartlari}/>:
      <QuickNotes key={settings.data.HazirNotlar.join('|')} notes={settings.data.HazirNotlar}/>)}
  </section>;
}

function useSave<T>(path:string){
  const client=useQueryClient();
  return useMutation({mutationFn:(body:T)=>api(path,{method:'PUT',body:JSON.stringify(body)}),onSuccess:()=>client.invalidateQueries()});
}

function General({settings}:{settings:FullSettings}){
  const client=useQueryClient();
  const waste=useMutation({mutationFn:(enabled:boolean)=>api<FullSettings>('/ayarlar/zayi',{method:'PUT',body:JSON.stringify({ZayiAktif:enabled})}),
    onSuccess:data=>client.setQueryData(['settings'],data)});
  const enabled=settings.ZayiAktif;
  return <div className="op-stack">
    <div className="op-settings-card">
      <div><h2>Zayi işlemi</h2><p>Etkin olduğunda adisyondan ürün çıkarma penceresinde “Zayi” seçeneği görünür. Kapalıyken zayi kaydı yapılamaz.</p></div>
      <div className="op-settings-action"><strong>{enabled?'Aktif':'Kapalı'}</strong><button type="button" className={enabled?'secondary':'primary'} aria-pressed={enabled} disabled={waste.isPending} onClick={()=>waste.mutate(!enabled)}>{waste.isPending?'Kaydediliyor…':enabled?'Zayiyi kapat':'Zayiyi etkinleştir'}</button></div>
      <ErrorBox error={waste.error}/>
    </div>
    <StoreForm key={JSON.stringify(settings.Isletme)} store={settings.Isletme}/>
    <DemoCard/>
  </div>;
}

function StoreForm({store}:{store:StoreProfile}){
  const [form,setForm]=useState({Unvan:store.Unvan,Adres:store.Adres??'',Telefon:store.Telefon??'',VergiDairesi:store.VergiDairesi??'',VergiNo:store.VergiNo??'',FisAltYazisi:store.FisAltYazisi??''});
  const save=useSave<typeof form>('/ayarlar/isletme');
  const set=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[key]:e.target.value}));
  const taxValid=!form.VergiNo||/^\d{10,11}$/.test(form.VergiNo);
  return <form className="op-form-card" onSubmit={e=>{e.preventDefault();save.mutate(form);}}>
    <h2>İşletme bilgisi</h2><p>Mağaza {store.MagazaKodu} (#{store.MagazaKayitNo}). Bu bilgiler müşteriye verilen bilgi fişinin başında ve altında yazılır.</p>
    <div className="craft-form">
      <div className="form-row"><label>Unvan<input required maxLength={120} value={form.Unvan} onChange={set('Unvan')}/></label><label>Telefon<input maxLength={30} value={form.Telefon} onChange={set('Telefon')}/></label></div>
      <label>Adres<input maxLength={300} value={form.Adres} onChange={set('Adres')}/></label>
      <div className="form-row"><label>Vergi dairesi<input maxLength={80} value={form.VergiDairesi} onChange={set('VergiDairesi')}/></label><label>Vergi / TC kimlik no<input inputMode="numeric" maxLength={11} value={form.VergiNo} onChange={set('VergiNo')}/></label></div>
      <label>Fiş alt yazısı<input maxLength={200} value={form.FisAltYazisi} onChange={set('FisAltYazisi')}/></label>
      {!taxValid&&<p className="error-text" role="status">Vergi numarası 10, TC kimlik numarası 11 haneli olmalı.</p>}
      <ErrorBox error={save.error}/>
      <div className="dialog-actions"><button className="primary" disabled={save.isPending||!form.Unvan.trim()||!taxValid}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Kaydet'}</button></div>
    </div>
  </form>;
}

function DemoCard(){
  const client=useQueryClient();
  const status=useQuery({queryKey:['demo-status'],queryFn:()=>api<DemoStatus>('/demo/durum')});
  const [confirm,setConfirm]=useState(false);
  const reset=useMutation({mutationFn:()=>api('/demo/sifirla',{method:'POST'}),onSuccess:async()=>{setConfirm(false);await client.invalidateQueries();}});
  return <div className="op-settings-card">
    <div><h2>Demo verisi</h2><p>{status.data?.Kalici?`Demo kayıtları bu sunucudaki dosyada saklanır; sunucu yeniden başlasa da korunur.${status.data.SonKayit?` Son kayıt: ${new Date(status.data.SonKayit).toLocaleString('tr-TR')}.`:''}`:'Demo kayıtları yalnızca bellekte tutulur; sunucu yeniden başlayınca sıfırlanır.'} Gerçek ERP veritabanına bağlı değildir.</p>
      {status.data?.SonHata&&<p className="error-text">{status.data.SonHata}</p>}</div>
    <div className="op-settings-action"><button type="button" className="danger" onClick={()=>setConfirm(true)}>Başlangıç verisine dön</button></div>
    {confirm&&<Modal title="Demo verisini sıfırla" onClose={()=>{if(!reset.isPending)setConfirm(false);}}>
      <p>Bütün adisyonlar, paket siparişleri, müşteri kartları, stok hareketleri, personel ve ayarlar başlangıç verisine döner. Bu işlem geri alınamaz.</p>
      <ErrorBox error={reset.error}/>
      <div className="dialog-actions"><button disabled={reset.isPending} onClick={()=>setConfirm(false)}>Vazgeç</button><button className="danger" disabled={reset.isPending} onClick={()=>reset.mutate()}>{reset.isPending?'Sıfırlanıyor…':'Sıfırla'}</button></div>
    </Modal>}
  </div>;
}

function FloorSetup(){
  const client=useQueryClient();
  const sections=useQuery({queryKey:['sections'],queryFn:()=>api<Section[]>('/bolumler')});
  const tables=useQuery({queryKey:['tables'],queryFn:()=>api<Table[]>('/masalar')});
  const [editSection,setEditSection]=useState<Section|true|null>(null);
  const [editTable,setEditTable]=useState<Table|true|null>(null);
  const remove=useMutation({mutationFn:(path:string)=>api(path,{method:'DELETE'}),onSuccess:()=>client.invalidateQueries()});
  const list=sections.data??[];
  return <div className="op-stack">
    <ErrorBox error={sections.error||tables.error||remove.error} retry={()=>{void sections.refetch();void tables.refetch();}}/>
    <div className="op-toolbar-row"><button className="secondary" onClick={()=>setEditSection(true)}><Plus size={16}/> Bölüm ekle</button><button className="primary" disabled={!list.length} onClick={()=>setEditTable(true)}><Plus size={16}/> Masa ekle</button></div>
    {list.map(section=>{const own=(tables.data??[]).filter(t=>t.RestorantBolumuKayitNo===section.KayitNo);return <section className="op-panel" key={section.KayitNo}>
      <div className="op-panel-head"><h2>{section.BolumAdi} <small className="op-note">{own.length} masa</small></h2><div>
        <button className="secondary" onClick={()=>setEditSection(section)}>Yeniden adlandır</button>
        <button className="secondary" disabled={own.length>0||remove.isPending} title={own.length?'Önce masaları taşıyın veya silin':''} onClick={()=>remove.mutate(`/bolumler/${section.KayitNo}`)} aria-label={`${section.BolumAdi} bölümünü sil`}><Trash2 size={15}/></button></div></div>
      {own.length===0?<div className="op-inline-empty">Bu bölümde masa yok.</div>:<div className="op-table-wrap"><table className="op-data-table"><tbody>{own.map(t=><tr key={t.MasaId}>
        <td><strong>{t.MasaAdi}</strong><small>{t.MasaKodu}</small></td><td>{t.BaslikKayitNo?<span className="op-badge is-warning">Açık adisyon</span>:t.Rezerve?<span className="op-badge">Rezerve</span>:null}</td>
        <td className="num"><button className="secondary" onClick={()=>setEditTable(t)}>Düzenle</button> <button className="secondary" disabled={!!t.BaslikKayitNo||remove.isPending} onClick={()=>remove.mutate(`/masalar/${t.MasaId}`)} aria-label={`${t.MasaAdi} sil`}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>}
    </section>;})}
    {editSection&&<NameDialog title={editSection===true?'Yeni bölüm':'Bölümü yeniden adlandır'} label="Bölüm adı" initial={editSection===true?'':editSection.BolumAdi} max={40}
      save={name=>api(editSection===true?'/bolumler':`/bolumler/${editSection.KayitNo}`,{method:editSection===true?'POST':'PUT',body:JSON.stringify({BolumAdi:name})})} close={()=>setEditSection(null)}/>}
    {editTable&&<TableDialog table={editTable===true?undefined:editTable} sections={list} close={()=>setEditTable(null)}/>}
  </div>;
}

function NameDialog({title,label,initial,max,save,close}:{title:string;label:string;initial:string;max:number;save:(name:string)=>Promise<unknown>;close:()=>void}){
  const client=useQueryClient();
  const [name,setName]=useState(initial);
  const mutation=useMutation({mutationFn:()=>save(name.trim()),onSuccess:async()=>{await client.invalidateQueries();close();}});
  return <Modal title={title} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();mutation.mutate();}}>
    <label>{label}<input autoFocus required maxLength={max} value={name} onChange={e=>setName(e.target.value)}/></label><ErrorBox error={mutation.error}/>
    <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!name.trim()||mutation.isPending}>Kaydet</button></div></form></Modal>;
}

function TableDialog({table,sections,close}:{table?:Table;sections:Section[];close:()=>void}){
  const client=useQueryClient();
  const [name,setName]=useState(table?.MasaAdi??'');
  const [section,setSection]=useState(String(table?.RestorantBolumuKayitNo??sections[0]?.KayitNo??''));
  const save=useMutation({mutationFn:()=>api(table?`/masalar/${table.MasaId}`:'/masalar',{method:table?'PUT':'POST',body:JSON.stringify({MasaAdi:name.trim(),BolumKayitNo:Number(section)})}),
    onSuccess:async()=>{await client.invalidateQueries();close();}});
  return <Modal title={table?`${table.MasaAdi} düzenle`:'Yeni masa'} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
    <div className="form-row"><label>Masa adı<input autoFocus required maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="ör. Masa 13"/></label>
      <label>Bölüm<select value={section} onChange={e=>setSection(e.target.value)}>{sections.map(s=><option key={s.KayitNo} value={s.KayitNo}>{s.BolumAdi}</option>)}</select></label></div>
    <ErrorBox error={save.error}/><div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!name.trim()||!section||save.isPending}>Kaydet</button></div></form></Modal>;
}

function Printers({printers}:{printers:Printer[]}){
  const menu=useQuery({queryKey:['menu','yonetim'],queryFn:()=>api<Category[]>('/menu/yonetim')});
  const [draft,setDraft]=useState(printers);
  const save=useSave<{Yazicilar:Printer[]}>('/ayarlar/yazicilar');
  const categories=menu.data??[];
  const owner=(id:number)=>draft.findIndex(p=>p.Kategoriler.includes(id));
  return <form className="op-form-card" onSubmit={e=>{e.preventDefault();save.mutate({Yazicilar:draft});}}>
    <h2>Yazıcı yönlendirmesi</h2><p>Her kategori bir mutfak istasyonuna gider (ör. içecekler bara). Atanmamış kategoriler ilk yazıcıya düşer. Mutfak ekranında istasyona göre süzülür; çıktı tarayıcının yazdırma penceresiyle alınır.</p>
    <ErrorBox error={menu.error}/>
    <div className="op-stack">{draft.map((printer,index)=><div className="op-option-editor" key={index}>
      <div className="op-option-editor-head"><label>Yazıcı / istasyon adı<input required maxLength={40} value={printer.Ad} onChange={e=>setDraft(d=>d.map((p,i)=>i===index?{...p,Ad:e.target.value}:p))}/></label>
        <button type="button" className="secondary" aria-label={`${printer.Ad||'Yazıcı'} kaldır`} onClick={()=>setDraft(d=>d.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div>
      <div className="op-inline-checks">{categories.map(c=>{const taken=owner(c.KayitNo);return <label key={c.KayitNo}><input type="checkbox" checked={printer.Kategoriler.includes(c.KayitNo)} disabled={taken>=0&&taken!==index}
        onChange={e=>setDraft(d=>d.map((p,i)=>i===index?{...p,Kategoriler:e.target.checked?[...p.Kategoriler,c.KayitNo]:p.Kategoriler.filter(x=>x!==c.KayitNo)}:p))}/>{c.GrupAdi}{taken>=0&&taken!==index?` (${draft[taken].Ad})`:''}</label>;})}</div>
    </div>)}</div>
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" disabled={draft.length>=10} onClick={()=>setDraft(d=>[...d,{KayitNo:0,Ad:'',Kategoriler:[]}])}><Plus size={15}/> Yazıcı ekle</button>
      <button className="primary" disabled={save.isPending||draft.some(p=>!p.Ad.trim())}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Kaydet'}</button></div>
  </form>;
}

function MealCards({cards}:{cards:MealCard[]}){
  const [draft,setDraft]=useState(cards.map(c=>({...c,rate:String(c.KomisyonOrani)})));
  const save=useSave<{Kartlar:MealCard[]}>('/ayarlar/yemek-kartlari');
  const valid=draft.every(c=>c.Ad.trim()&&/^\d{1,2}(?:[.,]\d{1,2})?$/.test(c.rate));
  return <form className="op-form-card" onSubmit={e=>{e.preventDefault();if(valid)save.mutate({Kartlar:draft.map(c=>({KayitNo:c.KayitNo,Ad:c.Ad.trim(),KomisyonOrani:Number(c.rate.replace(',','.')),Aktif:c.Aktif}))});}}>
    <h2>Yemek kartları</h2><p>Ödemede seçilecek kart türleri. Komisyon oranı raporda tahmini kesinti olarak gösterilir; sözleşmenizdeki oranı girin.</p>
    <div className="op-list-editor">{draft.map((card,index)=><div key={index}>
      <label>Kart adı<input required maxLength={40} value={card.Ad} onChange={e=>setDraft(d=>d.map((c,i)=>i===index?{...c,Ad:e.target.value}:c))}/></label>
      <label>Komisyon %<input inputMode="decimal" value={card.rate} onChange={e=>setDraft(d=>d.map((c,i)=>i===index?{...c,rate:e.target.value}:c))}/></label>
      <label className="op-check-label"><input type="checkbox" checked={card.Aktif} onChange={e=>setDraft(d=>d.map((c,i)=>i===index?{...c,Aktif:e.target.checked}:c))}/> Aktif</label></div>)}</div>
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button type="button" disabled={draft.length>=20} onClick={()=>setDraft(d=>[...d,{KayitNo:0,Ad:'',KomisyonOrani:0,Aktif:true,rate:'0'}])}><Plus size={15}/> Kart ekle</button>
      <button className="primary" disabled={save.isPending||!valid}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Kaydet'}</button></div>
  </form>;
}

function QuickNotes({notes}:{notes:string[]}){
  const [draft,setDraft]=useState(notes);
  const [next,setNext]=useState('');
  const save=useSave<{Notlar:string[]}>('/ayarlar/hazir-notlar');
  const add=()=>{const value=next.trim();if(value&&!draft.some(n=>n.toLocaleLowerCase('tr')===value.toLocaleLowerCase('tr'))&&draft.length<100){setDraft(d=>[...d,value]);setNext('');}};
  return <form className="op-form-card" onSubmit={e=>{e.preventDefault();save.mutate({Notlar:draft});}}>
    <h2>Hazır sipariş notları</h2><p>Garson ürün seçerken bu notlara dokunarak ekler; yazmaya gerek kalmaz. En fazla 100 not, her biri 40 karakter.</p>
    <div className="op-chip-row" style={{marginBottom:12}}>{draft.map(note=><button type="button" key={note} className="op-chip" aria-label={`${note} notunu kaldır`} onClick={()=>setDraft(d=>d.filter(n=>n!==note))}>{note} <small>✕</small></button>)}</div>
    <div className="op-toolbar-row"><label className="op-grow">Yeni not<input maxLength={40} value={next} onChange={e=>setNext(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/></label><button type="button" className="secondary" onClick={add} disabled={!next.trim()||draft.length>=100}><Plus size={15}/> Ekle</button></div>
    <ErrorBox error={save.error}/>
    <div className="dialog-actions"><button className="primary" disabled={save.isPending}>{save.isPending?'Kaydediliyor…':save.isSuccess?'Kaydedildi':'Kaydet'}</button></div>
  </form>;
}
