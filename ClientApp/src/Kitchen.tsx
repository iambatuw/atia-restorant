import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,ChefHat,Clock3} from 'lucide-react';
import {api} from './api';
import type {KitchenEvent,KitchenTicket} from './types';
import {Empty,ErrorBox,Loading} from './ui';

export function Kitchen(){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'all'|'urgent'>('all');
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
  const ready=useMutation({mutationFn:(id:number)=>api(`/mutfak/satirlar/${id}/hazir`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  const seen=useMutation({mutationFn:(id:number)=>api(`/mutfak/bildirimler/${id}/goruldu`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  const list=tickets.data??[];
  const late=list.filter(t=>t.BeklemeSuresi>=15);
  const visible=filter==='urgent'?late:list;

  return <section className="op-page op-kitchen" aria-label="Mutfak siparişleri">
    <header className="op-page-head"><div><h1>Mutfak</h1><p>Hazırlanmayı bekleyen siparişler</p></div><div className="op-head-count"><strong>{list.length}</strong><span>bekleyen</span><strong>{late.length}</strong><span>geciken</span></div></header>
    <div className="op-kitchen-toolbar" role="group" aria-label="Siparişleri filtrele"><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tüm siparişler <span>{list.length}</span></button><button aria-pressed={filter==='urgent'} onClick={()=>setFilter('urgent')}>15 dakikayı aşanlar <span>{late.length}</span></button></div>
    <ErrorBox error={tickets.error||ready.error||events.error||seen.error} retry={()=>{void tickets.refetch();void events.refetch();}}/>
    {!!events.data?.length&&<section className="op-panel op-kitchen-events"><div className="op-panel-head"><h2>Mutfak bildirimleri</h2><small>Yazdırma tarayıcı üzerinden yapılır</small></div><ul>{events.data.map(item=><li key={item.KayitNo}><strong>{item.Islem}</strong><span>{item.MasaAdi} · {item.Miktar} × {item.UrunAdi}{item.Not&&<small>{item.Not}</small>}</span><button type="button" onClick={()=>setPrintTarget(item)}>Yazdır</button><button type="button" disabled={seen.isPending} onClick={()=>seen.mutate(item.KayitNo)}>Görüldü</button></li>)}</ul></section>}
    {printTarget&&<div className="kitchen-print-ticket" aria-hidden="true"><h1>ATIA · Mutfak</h1><p>{new Date(printTarget.Tarih).toLocaleString('tr-TR')}</p><h2>{printTarget.MasaAdi}</h2><p>Adisyon #{printTarget.AdisyonNo} · {printTarget.Islem}</p><strong>{printTarget.Miktar} × {printTarget.UrunAdi}</strong>{printTarget.Not&&<p>{printTarget.Not}</p>}</div>}
    {tickets.isPending?<Loading/>:visible.length===0?<Empty><ChefHat size={30}/><h2>{filter==='urgent'?'Geciken sipariş yok':'Mutfak sırası boş'}</h2><p>Yeni siparişler burada görünecek.</p></Empty>:<div className="op-ticket-grid">
      {visible.map(ticket=><article className="op-ticket" key={ticket.BaslikKayitNo}>
        <header className="op-ticket-head"><div><span>{ticket.BolumAdi}, fiş #{ticket.BaslikKayitNo}</span><h2>{ticket.MasaAdi}</h2></div><strong className={ticket.BeklemeSuresi>=15?'late':''}><Clock3 size={16}/>{ticket.BeklemeSuresi} dk</strong></header>
        <ul className="op-ticket-items">{ticket.Satirlar.filter(line=>line.KalanMiktar>0).map(line=><li key={line.DetayKayitNo}><b>{line.KalanMiktar}×</b><div><strong>{line.StokAdi}</strong>{line.SatirAciklama&&<span>{line.SatirAciklama}</span>}</div><button type="button" disabled={ready.isPending} onClick={()=>ready.mutate(line.DetayKayitNo)}><Check size={15}/>{ready.isPending&&ready.variables===line.DetayKayitNo?'Kaydediliyor…':'Hazır'}</button></li>)}</ul>
      </article>)}
    </div>}
  </section>;
}
