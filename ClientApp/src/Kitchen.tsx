import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,ChefHat,Clock3,Filter} from 'lucide-react';
import {api} from './api';
import type {KitchenTicket} from './types';
import {Empty,ErrorBox,Loading} from './ui';
import './Kitchen.css';

export function Kitchen(){
  const client=useQueryClient();
  const [filter,setFilter]=useState<'all'|'urgent'|'salon'|'bahce'>('all');
  const [checkedItems,setCheckedItems]=useState<Record<number,boolean>>({});

  const tickets=useQuery({
    queryKey:['kitchen'],
    queryFn:()=>api<KitchenTicket[]>('/mutfak'),
    refetchInterval:10000
  });

  const ready=useMutation({
    mutationFn:(id:number)=>api(`/mutfak/${id}/hazir`,{method:'POST'}),
    onSuccess:()=>{
      client.invalidateQueries();
    }
  });

  const toggleItemCheck=(detayKayitNo:number)=>{
    setCheckedItems(prev=>({...prev,[detayKayitNo]:!prev[detayKayitNo]}));
  };

  const list=tickets.data??[];
  const urgentCount=list.filter(t=>t.BeklemeSuresi>=15).length;
  const maxWait=list.length>0?Math.max(...list.map(t=>t.BeklemeSuresi)):0;
  const filtered=list.filter(t=>{
    if(filter==='urgent') return t.BeklemeSuresi>=15;
    if(filter==='salon') return t.BolumAdi.toLowerCase().includes('salon');
    if(filter==='bahce') return t.BolumAdi.toLowerCase().includes('bahçe');
    return true;
  });

  return (
    <section className="kitchen-view" aria-label="Mutfak siparişleri">
      <header className="kitchen-view__heading">
        <div>
          <h1>Mutfak</h1>
          <p>Bekleyen siparişler</p>
        </div>
        <div className="kitchen-view__summary" aria-label="Sipariş özeti">
          <div><span>Bekleyen fiş</span><strong>{list.length}</strong></div>
          <div><span>15 dk ve üzeri</span><strong>{urgentCount}</strong></div>
          <div><span>En uzun bekleme</span><strong>{maxWait} <small>dk</small></strong></div>
        </div>
      </header>

      <div className="kitchen-view__filters" role="group" aria-label="Siparişleri filtrele">
        <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tümü <span>{list.length}</span></button>
        <button type="button" aria-pressed={filter==='urgent'} onClick={()=>setFilter('urgent')}>15 dk ve üzeri <span>{urgentCount}</span></button>
        <button type="button" aria-pressed={filter==='salon'} onClick={()=>setFilter('salon')}>Salon</button>
        <button type="button" aria-pressed={filter==='bahce'} onClick={()=>setFilter('bahce')}>Bahçe</button>
      </div>

      <ErrorBox error={tickets.error||ready.error} retry={()=>void tickets.refetch()}/>

      {tickets.isPending?(
        <Loading/>
      ):list.length===0?(
        <Empty>
          <ChefHat size={40} strokeWidth={1.4}/>
          <h3>Bekleyen sipariş yok</h3>
          <p>Yeni siparişler burada görünecek.</p>
        </Empty>
      ):filtered.length===0?(
        <Empty>
          <Filter size={32}/>
          <p>Bu filtreye uygun bekleyen sipariş yok.</p>
        </Empty>
      ):(
        <div className="kitchen-view__grid">
          {filtered.map(t=>{
            const isLate=t.BeklemeSuresi>=15;
            const isWarning=t.BeklemeSuresi>=10&&!isLate;
            const isPendingMutation=ready.isPending&&ready.variables===t.BaslikKayitNo;
            const checkedCount=t.Satirlar.filter(s=>checkedItems[s.DetayKayitNo]).length;
            const allChecked=t.Satirlar.length>0&&checkedCount===t.Satirlar.length;

            return (
              <article className={`kitchen-view__ticket ${isLate?'is-late':isWarning?'is-warning':''}`} key={t.BaslikKayitNo}>
                <header className="kitchen-view__ticket-header">
                  <div>
                    <p className="kitchen-view__area">{t.BolumAdi}</p>
                    <h2>{t.MasaAdi}</h2>
                    <span className="kitchen-view__ticket-id">Fiş #{t.BaslikKayitNo}</span>
                  </div>
                  <div className="kitchen-view__wait">
                    <Clock3 size={16} aria-hidden="true"/>
                    <span>{t.BeklemeSuresi} dk</span>
                    {isLate&&<span className="kitchen-view__late-label">Gecikmiş</span>}
                  </div>
                </header>
                <div className="kitchen-view__progress">İşaretlenen ürünler <strong>{checkedCount}/{t.Satirlar.length}</strong></div>
                <ul className="kitchen-view__items">
                  {t.Satirlar.map(s=>{
                    const checked=!!checkedItems[s.DetayKayitNo];
                    return (
                      <li key={s.DetayKayitNo}>
                        <label className={`kitchen-view__item ${checked?'is-checked':''}`}>
                          <input type="checkbox" checked={checked} onChange={()=>toggleItemCheck(s.DetayKayitNo)}/>
                          <span className="kitchen-view__quantity">{s.KalanMiktar}×</span>
                          <span className="kitchen-view__item-detail">
                            <strong>{s.StokAdi}</strong>
                            {s.SatirAciklama&&<span className="kitchen-view__note">{s.SatirAciklama}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <footer className="kitchen-view__footer">
                  <button type="button" className={allChecked?'is-complete':''} disabled={ready.isPending} onClick={()=>ready.mutate(t.BaslikKayitNo)}>
                    <Check size={18} aria-hidden="true"/>
                    {isPendingMutation?'Kaydediliyor…':'Sipariş hazır'}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
