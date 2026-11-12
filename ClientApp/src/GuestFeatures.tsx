import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {BellRing,Check,HandPlatter,Printer,ReceiptText,RefreshCw} from 'lucide-react';
import QRCode from 'qrcode';
import {api,ApiError} from './api';
import type {CallType,GuestCall,GuestTable,TableQr} from './types';
import {ErrorBox,Loading} from './ui';
import './Extensions.css';

const callNames:Record<CallType,string>={0:'Garson istiyor',1:'Hesap istiyor'};

/** Short beep through Web Audio; silently skipped when the browser blocks audio. */
export function beep(times=2){
  try{
    const AudioContextClass=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioContextClass) return;
    const context=new AudioContextClass();
    for(let i=0;i<times;i++){
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      oscillator.frequency.value=880;
      gain.gain.setValueAtTime(0.0001,context.currentTime+i*0.28);
      gain.gain.exponentialRampToValueAtTime(0.25,context.currentTime+i*0.28+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+i*0.28+0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime+i*0.28);
      oscillator.stop(context.currentTime+i*0.28+0.24);
    }
    window.setTimeout(()=>void context.close(),times*300+200);
  }catch{
    // Audio is an extra signal; the visual alert is always shown.
  }
}

export function readSoundSetting(key:string){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
export function writeSoundSetting(key:string,on:boolean){try{localStorage.setItem(key,on?'on':'off');}catch{/* per-device convenience only */}}

/** Returns true once for every id that was not in the previous list (ignores the first load). */
export function useNewItems(ids:number[]|undefined){
  const seen=useRef<Set<number>|null>(null);
  const [fresh,setFresh]=useState(0);
  useEffect(()=>{
    if(!ids) return;
    if(seen.current===null){seen.current=new Set(ids);return;}
    const added=ids.filter(id=>!seen.current!.has(id));
    ids.forEach(id=>seen.current!.add(id));
    if(added.length) setFresh(n=>n+1);
  },[ids]);
  return fresh;
}

/** Open guest calls from the QR menu, shown on the staff floor and overview screens. */
export function GuestCallsBar(){
  const client=useQueryClient();
  const calls=useQuery({queryKey:['guest-calls'],queryFn:()=>api<GuestCall[]>('/cagrilar'),refetchInterval:10000});
  const done=useMutation({mutationFn:(id:number)=>api(`/cagrilar/${id}/tamam`,{method:'POST'}),onSuccess:()=>client.invalidateQueries({queryKey:['guest-calls']})});
  const list=calls.data??[];
  const fresh=useNewItems(calls.data?.map(c=>c.KayitNo));
  useEffect(()=>{if(fresh&&readSoundSetting('atia_call_sound'))beep(2);},[fresh]);
  if(!list.length) return null;
  return <section className="op-call-bar" role="alert" aria-label="Misafir çağrıları">
    <BellRing size={18}/>
    {list.map(call=><span className="op-call" key={call.KayitNo}><strong>{call.MasaAdi}</strong> {callNames[call.Tip]}
      <small>{Math.max(0,Math.round((Date.now()-new Date(call.Tarih).getTime())/60000))} dk</small>
      <button type="button" className="secondary" disabled={done.isPending} onClick={()=>done.mutate(call.KayitNo)}><Check size={14}/> Tamam</button></span>)}
  </section>;
}

/** Settings tab: one QR per table that opens the menu for that table. */
export function QrCodesPanel(){
  const client=useQueryClient();
  const codes=useQuery({queryKey:['table-qr'],queryFn:()=>api<TableQr[]>('/masalar/qr')});
  const [images,setImages]=useState<Record<string,string>>({});
  const renew=useMutation({mutationFn:(id:number)=>api(`/masalar/${id}/qr-yenile`,{method:'POST'}),onSuccess:()=>client.invalidateQueries({queryKey:['table-qr']})});
  const base=`${location.origin}/menu?masa=`;
  useEffect(()=>{
    let cancelled=false;
    const list=codes.data??[];
    void Promise.all(list.map(async t=>[t.Kod,await QRCode.toDataURL(base+t.Kod,{margin:1,width:320,errorCorrectionLevel:'M'})] as const))
      .then(entries=>{if(!cancelled)setImages(Object.fromEntries(entries));});
    return ()=>{cancelled=true;};
  },[codes.data,base]);
  return <div className="op-stack">
    <div className="op-form-card"><h2>Masa QR kodları</h2><p>Misafir kodu okutunca o masanın menüsü açılır; oradan garson çağırabilir veya hesap isteyebilir. Kod kaybolur veya kötüye kullanılırsa yenileyin; eski kod çalışmaz.
      {location.hostname==='127.0.0.1'||location.hostname==='localhost'?' Şu an adres yalnız bu bilgisayarda çalışır; kodları sunucunun ağ adresiyle açtığınız sayfadan yazdırın.':''}</p>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={()=>window.print()}><Printer size={15}/> Tümünü yazdır</button></div></div>
    <ErrorBox error={codes.error||renew.error} retry={()=>void codes.refetch()}/>
    {codes.isPending?<Loading/>:<div className="op-qr-grid qr-print">{(codes.data??[]).map(t=><figure key={t.MasaKayitNo} className="op-qr-card">
      {images[t.Kod]?<img src={images[t.Kod]} alt={`${t.MasaAdi} QR kodu`} width={160} height={160}/>:<Loading/>}
      <figcaption><strong>{t.MasaAdi}</strong><span>{t.BolumAdi}</span></figcaption>
      <button type="button" className="secondary op-no-print" disabled={renew.isPending} onClick={()=>renew.mutate(t.MasaKayitNo)}><RefreshCw size={14}/> Yenile</button>
    </figure>)}</div>}
  </div>;
}

/** Customer side: table name and the two call buttons on the public menu opened from a QR code. */
export function GuestTableBar({code}:{code:string}){
  const table=useQuery({queryKey:['guest-table',code],queryFn:()=>api<GuestTable>(`/qr/${encodeURIComponent(code)}`),retry:false});
  const [sent,setSent]=useState<string>('');
  const call=useMutation({mutationFn:(type:CallType)=>api(`/cagri`,{method:'POST',body:JSON.stringify({Kod:code,Tip:type})}),
    onSuccess:(_r,type)=>setSent(type===1?'Hesap isteğiniz iletildi.':'Garson çağrınız iletildi.')});
  if(table.isError) return <div className="op-guest-bar" role="status">Bu QR kodu artık geçerli değil. Lütfen servis ekibine haber verin.</div>;
  if(!table.data) return null;
  const limited=call.error instanceof ApiError&&call.error.status===429;
  return <div className="op-guest-bar">
    <div><strong>{table.data.MasaAdi}</strong><span>{table.data.IsletmeAdi}</span></div>
    <div className="op-guest-actions">
      <button type="button" className="secondary" disabled={call.isPending} onClick={()=>call.mutate(0)}><HandPlatter size={16}/> Garson çağır</button>
      <button type="button" className="primary" disabled={call.isPending} onClick={()=>call.mutate(1)}><ReceiptText size={16}/> Hesap iste</button>
    </div>
    {(sent||call.error)&&<p role="status">{limited?'Çok sık istek gönderildi; biraz bekleyin.':call.error?'İstek gönderilemedi.':sent}</p>}
  </div>;
}
