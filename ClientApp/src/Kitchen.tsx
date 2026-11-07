import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,ChefHat,Clock3} from 'lucide-react';
import {api} from './api';
import type {KitchenTicket} from './types';
import {Empty,ErrorBox,Loading} from './ui';

export function Kitchen(){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'all'|'urgent'>('all');
  const tickets=useQuery({queryKey:['kitchen'],queryFn:()=>api<KitchenTicket[]>('/mutfak'),refetchInterval:10000});
  const ready=useMutation({mutationFn:(id:number)=>api(`/mutfak/${id}/hazir`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
  const list=tickets.data??[];
  const late=list.filter(t=>t.BeklemeSuresi>=15);
  const visible=filter==='urgent'?late:list;

  return <section className="op-page op-kitchen" aria-label="Mutfak siparişleri">
    <header className="op-page-head"><div><h1>Mutfak</h1><p>Hazırlanmayı bekleyen siparişler</p></div><div className="op-head-count"><strong>{list.length}</strong><span>bekleyen</span><strong>{late.length}</strong><span>geciken</span></div></header>
    <div className="op-kitchen-toolbar" role="group" aria-label="Siparişleri filtrele"><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tüm siparişler <span>{list.length}</span></button><button aria-pressed={filter==='urgent'} onClick={()=>setFilter('urgent')}>15 dakikayı aşanlar <span>{late.length}</span></button></div>
    <ErrorBox error={tickets.error||ready.error} retry={()=>void tickets.refetch()}/>
    {tickets.isPending?<Loading/>:visible.length===0?<Empty><ChefHat size={30}/><h2>{filter==='urgent'?'Geciken sipariş yok':'Mutfak sırası boş'}</h2><p>Yeni siparişler burada görünecek.</p></Empty>:<div className="op-ticket-grid">
      {visible.map(ticket=><article className="op-ticket" key={ticket.BaslikKayitNo}>
        <header className="op-ticket-head"><div><span>{ticket.BolumAdi}, fiş #{ticket.BaslikKayitNo}</span><h2>{ticket.MasaAdi}</h2></div><strong className={ticket.BeklemeSuresi>=15?'late':''}><Clock3 size={16}/>{ticket.BeklemeSuresi} dk</strong></header>
        <ul className="op-ticket-items">{ticket.Satirlar.map(line=><li key={line.DetayKayitNo}><b>{line.KalanMiktar}×</b><div><strong>{line.StokAdi}</strong>{line.SatirAciklama&&<span>{line.SatirAciklama}</span>}</div></li>)}</ul>
        <footer><button className="primary" type="button" disabled={ready.isPending} onClick={()=>ready.mutate(ticket.BaslikKayitNo)}><Check size={17}/>{ready.isPending&&ready.variables===ticket.BaslikKayitNo?'Kaydediliyor…':'Sipariş hazır'}</button></footer>
      </article>)}
    </div>}
  </section>;
}
