import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,ChefHat,Clock3} from 'lucide-react';
import {api} from './api';
import type {FullSettings,KitchenEvent,KitchenTicket} from './types';
import {beep,readSoundSetting,useNewItems,writeSoundSetting} from './GuestFeatures';
import {Empty,ErrorBox,Loading} from './ui';

export function Kitchen(){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'all'|'urgent'>('all');
  const [station,setStation]=useState<number|null>(null);
  const [sound,setSound]=useState(()=>readSoundSetting('atia_kitchen_sound'));
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const printers=settings.data?.Yazicilar??[];
  const [printTarget,setPrintTarget]=useState<KitchenEvent|null>(null);
  useEffect(()=>{
    if(!printTarget)return;
    const done=()=>setPrintTarget(null);
    window.addEventListener('afterprint',done);
    const timer=window.setTimeout(()=>window.print(),0);
    return()=>{window.clearTimeout(timer);window.removeEventListener('afterprint',done);};
  },[printTarget]);
  const tickets=useQuery({queryKey:['kitchen'],queryFn:()=>api<KitchenTicket[]>('/mutfak'),refetchInterval:10000});
  const events=useQuery({queryKey:['kitchen-events'],queryFn:()=>api<KitchenEvent[]>('/mutfak/bildirimler'),refetchInterval:10000});
  // New kitchen notifications ring once per arrival; the setting is remembered per device.
  const arrivals=useNewItems(events.data?.map(item=>item.KayitNo));
  useEffect(()=>{if(arrivals&&sound)beep(3);},[arrivals,sound]);
  const ready=useMutation({mutationFn:(id:number)=>api(`/mutfak/satirlar/${id}/hazir`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  const print=useMutation({mutationFn:(id:number)=>api<KitchenEvent>(`/mutfak/bildirimler/${id}/yazdir`,{method:'POST'}),onSuccess:item=>{void client.invalidateQueries({queryKey:['kitchen-events']});setPrintTarget(item);}});
  const printResult=useMutation({mutationFn:({id,success}:{id:number;success:boolean})=>api(`/mutfak/bildirimler/${id}/yazdirma-sonucu`,{method:'POST',body:JSON.stringify({Basarili:success})}),onSuccess:()=>client.invalidateQueries({queryKey:['kitchen-events']})});
  const seen=useMutation({mutationFn:(id:number)=>api(`/mutfak/bildirimler/${id}/goruldu`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  // A station sees only its own lines; tickets without any of its lines disappear from that view.
  const list=(tickets.data??[]).map(t=>station===null?t:{...t,Satirlar:t.Satirlar.filter(line=>line.YaziciKayitNo===station)})
    .filter(t=>t.Satirlar.some(line=>line.KalanMiktar>0));
  const queue=(events.data??[]).filter(item=>station===null||item.YaziciKayitNo===station);
  const late=list.filter(t=>t.BeklemeSuresi>=15);
  const visible=filter==='urgent'?late:list;

  return <section className="op-page op-kitchen" aria-label="Mutfak siparişleri">
    <header className="op-page-head"><div><h1>Mutfak</h1><p>Hazırlanmayı bekleyen siparişler</p></div><div className="op-head-count"><strong>{list.length}</strong><span>bekleyen</span><strong>{late.length}</strong><span>geciken</span></div></header>
    <div className="op-kitchen-toolbar" role="group" aria-label="Siparişleri filtrele"><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tüm siparişler <span>{list.length}</span></button><button aria-pressed={filter==='urgent'} onClick={()=>setFilter('urgent')}>15 dakikayı aşanlar <span>{late.length}</span></button>
      {printers.length>1&&<><button aria-pressed={station===null} onClick={()=>setStation(null)}>Tüm istasyonlar</button>{printers.map(p=><button key={p.KayitNo} aria-pressed={station===p.KayitNo} onClick={()=>setStation(p.KayitNo)}>{p.Ad}</button>)}</>}
      <button aria-pressed={sound} onClick={()=>{const next=!sound;setSound(next);writeSoundSetting('atia_kitchen_sound',next);if(next)beep(1);}}>{sound?'Sesli uyarı açık':'Sesli uyarı kapalı'}</button></div>
    <ErrorBox error={tickets.error||ready.error||events.error||seen.error||print.error||printResult.error} retry={()=>{void tickets.refetch();void events.refetch();}}/>
    {!!queue.length&&<section className="op-panel op-kitchen-events"><div className="op-panel-head"><h2>Yazdırma kuyruğu</h2><small>Çıktıyı aldıktan sonra sonucu elle doğrulayın</small></div><ul>{queue.map(item=><li key={item.KayitNo}><strong>{item.Islem}</strong><span>{item.MasaAdi} · {item.Miktar} × {item.UrunAdi}{item.YaziciAdi&&<small>{item.YaziciAdi}</small>}{item.Not&&<small>{item.Not}</small>}<small>{['Bekliyor','Çıktı kontrolü','Çıktı alındı','Yazdırma başarısız'][item.YazdirmaDurumu]} · {item.YazdirmaDenemesi} deneme</small></span>{(item.YazdirmaDurumu===0||item.YazdirmaDurumu===3)&&<button type="button" disabled={print.isPending} onClick={()=>print.mutate(item.KayitNo)}>{item.YazdirmaDurumu===3?'Yeniden dene':'Yazdır'}</button>}{item.YazdirmaDurumu===1&&<><button type="button" disabled={printResult.isPending} onClick={()=>printResult.mutate({id:item.KayitNo,success:true})}>Çıktı alındı</button><button type="button" disabled={printResult.isPending} onClick={()=>printResult.mutate({id:item.KayitNo,success:false})}>Alınamadı</button></>}{item.YazdirmaDurumu===2&&<button type="button" disabled={seen.isPending} onClick={()=>seen.mutate(item.KayitNo)}>Kuyruktan kaldır</button>}</li>)}</ul></section>}
    {printTarget&&<div className="kitchen-print-ticket" aria-hidden="true"><h1>ATIA · {printTarget.YaziciAdi??'Mutfak'}</h1><p>{new Date(printTarget.Tarih).toLocaleString('tr-TR')}</p><h2>{printTarget.MasaAdi}</h2><p>Adisyon #{printTarget.AdisyonNo} · {printTarget.Islem}</p><strong>{printTarget.Miktar} × {printTarget.UrunAdi}</strong>{printTarget.Not&&<p>{printTarget.Not}</p>}</div>}
    {tickets.isPending?<Loading/>:visible.length===0?<Empty><ChefHat size={30}/><h2>{filter==='urgent'?'Geciken sipariş yok':'Mutfak sırası boş'}</h2><p>Yeni siparişler burada görünecek.</p></Empty>:<div className="op-ticket-grid">
      {visible.map(ticket=><article className="op-ticket" key={ticket.BaslikKayitNo}>
        <header className="op-ticket-head"><div><span>{ticket.BolumAdi}, fiş #{ticket.BaslikKayitNo}</span><h2>{ticket.MasaAdi}</h2></div><strong className={ticket.BeklemeSuresi>=15?'late':''}><Clock3 size={16}/>{ticket.BeklemeSuresi} dk</strong></header>
        <ul className="op-ticket-items">{ticket.Satirlar.filter(line=>line.KalanMiktar>0).map(line=><li key={line.DetayKayitNo}><b>{line.KalanMiktar}×</b><div><strong>{line.StokAdi}</strong>{line.SecimMetni&&<span>{line.SecimMetni}</span>}{line.SatirAciklama&&<span>{line.SatirAciklama}</span>}</div><button type="button" disabled={ready.isPending} onClick={()=>ready.mutate(line.DetayKayitNo)}><Check size={15}/>{ready.isPending&&ready.variables===line.DetayKayitNo?'Kaydediliyor…':'Hazır'}</button></li>)}</ul>
      </article>)}
    </div>}
  </section>;
}
