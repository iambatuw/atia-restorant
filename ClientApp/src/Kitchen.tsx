import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,ChefHat,Clock3} from 'lucide-react';
import {api} from './api';
import type {KitchenTicket} from './types';
import {Empty,ErrorBox,Loading} from './ui';
export function Kitchen(){
 const client=useQueryClient();const tickets=useQuery({queryKey:['kitchen'],queryFn:()=>api<KitchenTicket[]>('/mutfak'),refetchInterval:15000});
 const ready=useMutation({mutationFn:(id:number)=>api(`/mutfak/${id}/hazir`,{method:'POST'}),onSuccess:()=>client.invalidateQueries()});
 return <section><div className="page-heading"><div><h1>Mutfak ekranı</h1><p>Sipariş sırasını takip edin, hazırlananları işaretleyin.</p></div><span className="pill"><ChefHat size={16}/>{tickets.data?.length??'—'} bekleyen adisyon</span></div><ErrorBox error={tickets.error||ready.error} retry={()=>void tickets.refetch()}/>{tickets.isPending?<Loading/>:!tickets.data?.length?<Empty><ChefHat size={40}/>Bekleyen sipariş yok. Yeni siparişler burada görünecek.</Empty>:<div className="kitchen-grid">{tickets.data.map(t=><article className={`ticket ${t.BeklemeSuresi>=15?'late':''}`} key={t.BaslikKayitNo}><header><div><small>{t.BolumAdi}</small><h2>{t.MasaAdi}</h2></div><span className="wait"><Clock3 size={15}/>{t.BeklemeSuresi} dk</span></header><div className="ticket-id">Adisyon {t.BaslikKayitNo}</div><ul>{t.Satirlar.map(s=><li key={s.DetayKayitNo}><span className="ticket-quantity">{s.KalanMiktar}</span><div><strong>{s.StokAdi}</strong>{s.SatirAciklama&&<p>{s.SatirAciklama}</p>}</div></li>)}</ul><button className="primary full" disabled={ready.isPending} onClick={()=>ready.mutate(t.BaslikKayitNo)}><Check size={19}/>{ready.isPending&&ready.variables===t.BaslikKayitNo?'Kaydediliyor…':'Sipariş hazır'}</button></article>)}</div>}</section>;
}
