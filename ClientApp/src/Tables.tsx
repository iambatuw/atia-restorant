import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Plus,
  Minus,
  Trash2,
  ReceiptText,
  Users,
  Search,
  X,
  Split,
  GitMerge,
  MoveRight,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type {OrderLine,Product,Receipt,Section,Session,Table,PosCihazTipi,PosIslemKayit} from './types';
import {
  api,
  money,
  toCents,
  masaTasi,
  masaAyir,
  masaBirlestir,
  masaOdeme,
  posIslemBaslat,
  posIslemSorgula,
  posIslemSimuleSonuc
} from './api';
import {Empty,ErrorBox,Loading,Modal} from './ui';
import {MenuPage} from './MenuPage';

export function Tables({session}:{session:Session}){
  const tables=useQuery({queryKey:['tables'],queryFn:()=>api<Table[]>('/masalar'),refetchInterval:15000});
  const sections=useQuery({queryKey:['sections'],queryFn:()=>api<Section[]>('/bolumler'),refetchInterval:15000});
  const [section,setSection]=useState<number|null>(null);
  const [status,setStatus]=useState('all');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<number|null>(null);

  const table=tables.data?.find(t=>t.MasaId===selected);
  const visible=(tables.data??[]).filter(t=>
    (section===null||t.RestorantBolumuKayitNo===section)&&
    (status==='all'||(status==='busy'?!!t.BaslikKayitNo:status==='reserved'?t.Rezerve:!t.BaslikKayitNo&&!t.Rezerve))&&
    t.MasaAdi.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Masa planı</h1>
          <p>Salonun tamamı, bir bakışta.</p>
        </div>
        <div className="date-label">
          {new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
        </div>
      </div>
      <div className={`floor-layout ${table?'has-selection':''}`}>
        <section className="floor">
          <div className="floor-toolbar">
            <div className="tabs">
              <button className={section===null?'selected':''} onClick={()=>setSection(null)}>
                Tüm bölümler <span>{tables.data?.length??'—'}</span>
              </button>
              {sections.data?.map(s=>(
                <button key={s.KayitNo} className={section===s.KayitNo?'selected':''} onClick={()=>setSection(s.KayitNo)}>
                  {s.BolumAdi} <span>{s.ToplamMasa}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="floor-filter">
            <div className="status-filters" aria-label="Masa durumları">
              {[['all','Tümü'],['busy','Dolu'],['free','Boş'],['reserved','Rezerve']].map(([id,label])=>(
                <button key={id} aria-pressed={status===id} className={status===id?'current':''} onClick={()=>setStatus(id)}>
                  <i className={`dot ${id}`}/>{label}
                </button>
              ))}
            </div>
            <div className="search compact">
              <Search size={16}/>
              <input placeholder="Masa ara…" aria-label="Masa ara" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
          <ErrorBox error={tables.error||sections.error} retry={()=>{void tables.refetch();void sections.refetch();}}/>
          {tables.isPending?<Loading/>:visible.length===0?<Empty>Bu filtreye uygun masa yok.</Empty>:(
            <div className="table-grid">
              {visible.map(t=>(
                <button
                  className={`table-tile ${t.BaslikKayitNo?'occupied':t.Rezerve?'reserved':'free'} ${selected===t.MasaId?'picked':''}`}
                  key={t.MasaId}
                  onClick={()=>setSelected(t.MasaId)}
                  aria-pressed={selected===t.MasaId}
                >
                  <div className="table-top">
                    <span className="table-state"><i className="dot"/>{t.BaslikKayitNo?'Dolu':t.Rezerve?'Rezerve':'Boş'}</span>
                    {t.BaslikKayitNo?<span className="elapsed"><Clock3 size={12}/>{minutes(t.AcilisTarihi)} dk</span>:null}
                  </div>
                  <div className="table-center">
                    <Armchair size={28} strokeWidth={1.4}/>
                    <h2>{t.MasaAdi}</h2>
                    <span>{t.RestorantBolumAdi}</span>
                  </div>
                  <div className="table-bottom">
                    {t.BaslikKayitNo?(
                      <>
                        <span><Users size={14}/>{t.KisiSayisi||'—'}</span>
                        <strong>{money(t.Tutar)}</strong>
                      </>
                    ):(
                      <>
                        <span>{t.Rezerve?'Rezervasyon var':'Siparişe hazır'}</span>
                        <Plus size={17}/>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="floor-note"><i className="dot free"/> Masa seçerek adisyonu açın veya yeni sipariş ekleyin.</div>
        </section>
        {table?(
          <TableOrder key={table.MasaId} table={table} admin={session.Rol==='Admin'} allTables={tables.data??[]} close={()=>setSelected(null)}/>
        ):(
          <aside className="order-placeholder">
            <ReceiptText size={42} strokeWidth={1.2}/>
            <h2>Servise hazırız.</h2>
            <p>Adisyonu görmek için<br/>bir masa seçin.</p>
            <span>Masalar anlık güncellenir</span>
          </aside>
        )}
      </div>
    </>
  );
}

function minutes(date:string|null){
  return date?Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000)):0;
}

function TableOrder({table,admin,allTables,close}:{table:Table;admin:boolean;allTables:Table[];close:()=>void}){
  const client=useQueryClient();
  const [picker,setPicker]=useState(false);
  const [payment,setPayment]=useState(false);
  const [transfer,setTransfer]=useState(false);
  const [split,setSplit]=useState(false);
  const [merge,setMerge]=useState(false);
  const [cancel,setCancel]=useState<OrderLine|null>(null);
  const [note,setNote]=useState('');

  const receipt=useQuery({
    queryKey:['receipt',table.MasaId],
    queryFn:()=>api<Receipt|null>(`/masalar/${table.MasaId}/adisyon`),
    refetchInterval:15000
  });

  const mutation=useMutation({
    mutationFn:({path,method,body}:{path:string;method:string;body?:unknown})=>
      api(path,{method,body:body?JSON.stringify(body):undefined}),
    onSuccess:()=>client.invalidateQueries()
  });

  const transferMutation=useMutation({
    mutationFn:(hedefMasaKayitNo:number)=>masaTasi({KaynakMasaKayitNo:table.MasaId,HedefMasaKayitNo:hedefMasaKayitNo}),
    onSuccess:async()=>{
      await client.invalidateQueries();
      setTransfer(false);
      close();
    }
  });

  const busy=mutation.isPending||transferMutation.isPending;
  const order=receipt.data;

  const add=(p:Product)=>{
    mutation.mutate(
      {path:'/siparisler',method:'POST',body:{MasaKayitNo:table.MasaId,StokKayitNo:p.KayitNo,Miktar:1,SatirAciklama:note}},
      {onSuccess:()=>{setPicker(false);setNote('');}}
    );
  };

  const change=(line:OrderLine,delta:number)=>{
    if(line.Miktar+delta<=0){
      setCancel(line);
      return;
    }
    mutation.mutate({
      path:`/siparisler/${line.KayitNo}`,
      method:'PATCH',
      body:{DetayKayitNo:line.KayitNo,Miktar:line.Miktar+delta,SatirAciklama:line.SatirAciklama,Ikram:line.Ikram}
    });
  };

  return (
    <aside className="order-panel">
      <div className="order-heading">
        <div>
          <span className="subtle">{table.RestorantBolumAdi}</span>
          <h2>{table.MasaAdi}</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="Adisyon panelini kapat">
          <X size={20}/>
        </button>
      </div>
      <div className="receipt-meta">
        <span><ReceiptText size={15}/>{order?`Adisyon ${order.KayitNo}`:'Yeni adisyon'}</span>
        <span><Clock3 size={15}/>{minutes(table.AcilisTarihi)} dk</span>
      </div>
      <ErrorBox error={receipt.error||mutation.error} retry={()=>void receipt.refetch()}/>
      <div className="order-lines">
        {receipt.isPending?<Loading/>:!order||order.Detaylar.length===0?(
          <Empty>Henüz sipariş yok.<br/>Menüden ürün ekleyerek başlayın.</Empty>
        ):(
          order.Detaylar.map(line=>(
            <div className="order-line" key={line.KayitNo}>
              <div className="line-title">
                <strong>{line.StokAdi}</strong>
                <strong>{money(line.SatirTutari)}</strong>
              </div>
              {line.SatirAciklama?<small className="order-note">{line.SatirAciklama}</small>:null}
              <div className="line-controls">
                <span>{money(line.BirimFiyat)} / adet</span>
                <div className="quantity">
                  <button disabled={busy} aria-label={`${line.StokAdi} azalt`} onClick={()=>change(line,-1)}>
                    <Minus size={14}/>
                  </button>
                  <span>{line.Miktar}</span>
                  <button disabled={busy} aria-label={`${line.StokAdi} artır`} onClick={()=>change(line,1)}>
                    <Plus size={14}/>
                  </button>
                </div>
                <button disabled={busy} className="delete-line" aria-label={`${line.StokAdi} sil`} onClick={()=>setCancel(line)}>
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="order-actions">
        <button className="secondary full" disabled={busy||receipt.isPending||!!receipt.error} onClick={()=>{mutation.reset();setPicker(true);}}>
          <Plus size={18}/> Ürün ekle
        </button>
        <div className="total">
          <span>Hesap toplamı</span>
          <strong>{money(order?.GenelToplam)}</strong>
        </div>
        {admin?(
          <>
            <button className="primary full" disabled={!order||busy} onClick={()=>setPayment(true)}>
              <ReceiptText size={18}/> Ödeme al <ArrowRight size={17}/>
            </button>
            <div className="table-actions-row">
              <button className="secondary" disabled={!order||busy} onClick={()=>setTransfer(true)} title="Adisyonu boş masaya aktar">
                <MoveRight size={14}/> Taşı
              </button>
              <button className="secondary" disabled={!order||order.Detaylar.length<=1||busy} onClick={()=>setSplit(true)} title="Sipariş satırlarını yeni masaya ayır">
                <Split size={14}/> Ayır
              </button>
              <button className="secondary" disabled={!order||busy} onClick={()=>setMerge(true)} title="Diğer açık masaları bu masaya birleştir">
                <GitMerge size={14}/> Birleştir
              </button>
            </div>
          </>
        ):(
          <p className="permission-note">Ödeme ve masa transfer işlemlerini yönetici tamamlar.</p>
        )}
      </div>

      {picker&&(
        <Modal title={`${table.MasaAdi} · Ürün ekle`} onClose={()=>{if(!busy)setPicker(false);}}>
          <label>Sipariş notu <input maxLength={250} value={note} onChange={e=>setNote(e.target.value)} placeholder="Örn. soğansız, az pişmiş"/></label>
          <ErrorBox error={mutation.error}/>
          <MenuPage onAdd={add} busy={busy}/>
          {busy&&<p role="status">Sipariş ekleniyor…</p>}
        </Modal>
      )}

      {cancel&&(
        <Modal title="Ürünü adisyondan kaldır" onClose={()=>{if(!busy)setCancel(null);}}>
          <p><strong>{cancel.StokAdi}</strong> ({cancel.Miktar} adet) adisyondan kaldırılacak.</p>
          <ErrorBox error={mutation.error}/>
          <div className="dialog-actions">
            <button disabled={busy} onClick={()=>setCancel(null)}>Vazgeç</button>
            <button className="danger" disabled={busy} onClick={()=>mutation.mutate({path:`/siparisler/${cancel.KayitNo}`,method:'DELETE'},{onSuccess:()=>setCancel(null)})}>
              Ürünü kaldır
            </button>
          </div>
        </Modal>
      )}

      {payment&&order&&(
        <PaymentModal receipt={order} table={table} onClose={()=>setPayment(false)}/>
      )}

      {transfer&&(
        <Modal title={`${table.MasaAdi} · Masayı taşı`} onClose={()=>{if(!busy)setTransfer(false);}}>
          <p>Adisyonun taşınacağı boş masayı seçin.</p>
          <ErrorBox error={transferMutation.error||mutation.error}/>
          <div className="transfer-list">
            {allTables.filter(t=>t.MasaId!==table.MasaId&&!t.BaslikKayitNo&&!t.BirlesmisMasa&&!t.Rezerve).map(t=>(
              <button key={t.MasaId} disabled={busy} onClick={()=>transferMutation.mutate(t.MasaId)}>
                <Armchair size={18}/>{t.MasaAdi}<span>{t.RestorantBolumAdi}</span><ArrowRight size={16}/>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {split&&order&&(
        <SplitModal receipt={order} table={table} allTables={allTables} onClose={()=>setSplit(false)}/>
      )}

      {merge&&order&&(
        <MergeModal receipt={order} table={table} allTables={allTables} onClose={()=>setMerge(false)}/>
      )}
    </aside>
  );
}

// ───── MASA AYIRMA MODALI ─────
function SplitModal({receipt,table,allTables,onClose}:{receipt:Receipt;table:Table;allTables:Table[];onClose:()=>void}){
  const client=useQueryClient();
  const emptyTables=allTables.filter(t=>t.MasaId!==table.MasaId&&!t.BaslikKayitNo&&!t.BirlesmisMasa&&!t.Rezerve);
  const [targetId,setTargetId]=useState<number|null>(emptyTables[0]?.MasaId??null);
  const [splitQty,setSplitQty]=useState<Record<number,number>>({});

  const toggleLine=(lineKayitNo:number)=>{
    setSplitQty(prev=>{
      const next={...prev};
      if((next[lineKayitNo]??0)>0){
        delete next[lineKayitNo];
      }else{
        next[lineKayitNo]=1;
      }
      return next;
    });
  };

  const adjustQty=(lineKayitNo:number,delta:number,maxQty:number)=>{
    setSplitQty(prev=>{
      const current=prev[lineKayitNo]??0;
      const updated=Math.max(1,Math.min(maxQty,current+delta));
      return {...prev,[lineKayitNo]:updated};
    });
  };

  const ayrilanSatirlar=Object.entries(splitQty)
    .filter(([_,qty])=>qty>0)
    .map(([id,qty])=>({DetayKayitNo:Number(id),Miktar:qty}));

  let ayrilanTutar=0;
  for(const item of ayrilanSatirlar){
    const line=receipt.Detaylar.find(d=>d.KayitNo===item.DetayKayitNo);
    if(line&&!line.Ikram){
      ayrilanTutar+=line.BirimFiyat*item.Miktar;
    }
  }

  const kalanTutar=Math.max(0,receipt.GenelToplam-ayrilanTutar);
  const hepsiSecildi=receipt.Detaylar.length>0&&receipt.Detaylar.every(d=>(splitQty[d.KayitNo]??0)===d.Miktar);
  const splitGecerli=targetId!==null&&ayrilanSatirlar.length>0&&!hepsiSecildi;

  const splitMutation=useMutation({
    mutationFn:()=>masaAyir({
      MasaKayitNo:table.MasaId,
      HedefMasaKayitNo:targetId!,
      AyrilanSatirlar:ayrilanSatirlar
    }),
    onSuccess:async()=>{
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal title={`${table.MasaAdi} · Masayı ayır`} onClose={()=>{if(!splitMutation.isPending)onClose();}}>
      <p>Yeni masaya aktarılacak siparişleri ve hedef masayı belirleyin.</p>
      <ErrorBox error={splitMutation.error}/>

      {emptyTables.length===0?(
        <div className="error">
          <AlertCircle size={18}/>
          <span>Ayrılabilecek boş masa bulunamadı. Lütfen önce bir masa boşaltın veya rezerve olmayan boş masa açın.</span>
        </div>
      ):(
        <>
          <label>
            Hedef Boş Masa
            <select
              value={targetId??''}
              onChange={e=>setTargetId(Number(e.target.value))}
              disabled={splitMutation.isPending}
            >
              {emptyTables.map(t=>(
                <option key={t.MasaId} value={t.MasaId}>
                  {t.MasaAdi} ({t.RestorantBolumAdi})
                </option>
              ))}
            </select>
          </label>

          <div className="split-item-list">
            {receipt.Detaylar.map(line=>{
              const isSelected=(splitQty[line.KayitNo]??0)>0;
              const currentQty=splitQty[line.KayitNo]??1;
              return (
                <div key={line.KayitNo} className={`split-item-row ${isSelected?'selected':''}`}>
                  <div className="split-item-info">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={()=>toggleLine(line.KayitNo)}
                      id={`split-check-${line.KayitNo}`}
                    />
                    <label htmlFor={`split-check-${line.KayitNo}`} className="split-item-title">
                      <strong>{line.StokAdi}</strong>
                      <small>{line.Miktar} adet mevcut · {money(line.BirimFiyat)}</small>
                    </label>
                  </div>
                  {isSelected&&(
                    <div className="split-qty-controls">
                      <button
                        type="button"
                        disabled={currentQty<=1||splitMutation.isPending}
                        onClick={()=>adjustQty(line.KayitNo,-1,line.Miktar)}
                      >
                        <Minus size={14}/>
                      </button>
                      <span>{currentQty}</span>
                      <button
                        type="button"
                        disabled={currentQty>=line.Miktar||splitMutation.isPending}
                        onClick={()=>adjustQty(line.KayitNo,1,line.Miktar)}
                      >
                        <Plus size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="split-summary-box">
            <div className="split-summary-item">
              <span>Yeni Masaya Ayrılacak</span>
              <strong>{money(ayrilanTutar)}</strong>
            </div>
            <div className="split-summary-item">
              <span>Mevcut Masada Kalan</span>
              <strong>{money(kalanTutar)}</strong>
            </div>
          </div>

          {hepsiSecildi&&(
            <p className="error-text">
              Tüm siparişler ayrılamaz; masanın tamamını aktarmak için &quot;Masayı taşı&quot; işlemini kullanın.
            </p>
          )}

          <div className="dialog-actions">
            <button disabled={splitMutation.isPending} onClick={onClose}>
              <ArrowLeft size={15}/> Vazgeç
            </button>
            <button
              className="primary"
              disabled={!splitGecerli||splitMutation.isPending}
              onClick={()=>splitMutation.mutate()}
            >
              {splitMutation.isPending?'Ayrılıyor…':'Masayı ayır'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ───── MASA BİRLEŞTİRME MODALI ─────
function MergeModal({receipt,table,allTables,onClose}:{receipt:Receipt;table:Table;allTables:Table[];onClose:()=>void}){
  const client=useQueryClient();
  const otherOccupied=allTables.filter(t=>t.MasaId!==table.MasaId&&!!t.BaslikKayitNo&&!t.BirlesmisMasa);
  const [selectedIds,setSelectedIds]=useState<number[]>([]);

  const toggleTable=(id:number)=>{
    setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };

  const selectedTables=otherOccupied.filter(t=>selectedIds.includes(t.MasaId));
  const mergedTotal=selectedTables.reduce((sum,t)=>sum+(t.Tutar??0),0);
  const combinedTotal=receipt.GenelToplam+mergedTotal;

  const mergeMutation=useMutation({
    mutationFn:()=>masaBirlestir({
      AnaMasaKayitNo:table.MasaId,
      BirlestirilecekMasaKayitNolar:selectedIds
    }),
    onSuccess:async()=>{
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal title={`${table.MasaAdi} · Masaları birleştir`} onClose={()=>{if(!mergeMutation.isPending)onClose();}}>
      <p><strong>{table.MasaAdi}</strong> ana masa olacak şekilde diğer açık masaların sipariş ve ödemelerini buraya toplayın.</p>
      <ErrorBox error={mergeMutation.error}/>

      {otherOccupied.length===0?(
        <Empty>Birleştirilebilecek açık başka masa yok.</Empty>
      ):(
        <>
          <div className="merge-item-list">
            {otherOccupied.map(t=>{
              const isSelected=selectedIds.includes(t.MasaId);
              return (
                <div
                  key={t.MasaId}
                  className={`merge-item-row ${isSelected?'selected':''}`}
                  onClick={()=>toggleTable(t.MasaId)}
                >
                  <div className="merge-item-left">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={()=>toggleTable(t.MasaId)}
                      onClick={e=>e.stopPropagation()}
                      id={`merge-check-${t.MasaId}`}
                    />
                    <div className="merge-item-meta">
                      <strong>{t.MasaAdi}</strong>
                      <small>{t.RestorantBolumAdi} · {t.KisiSayisi} kişi</small>
                    </div>
                  </div>
                  <span className="merge-item-total">{money(t.Tutar)}</span>
                </div>
              );
            })}
          </div>

          <div className="merge-summary-box">
            <div className="split-summary-item">
              <span>Ana Masa ({table.MasaAdi})</span>
              <strong>{money(receipt.GenelToplam)}</strong>
            </div>
            <div className="split-summary-item">
              <span>Birleşen Masalar ({selectedIds.length})</span>
              <strong>{money(mergedTotal)}</strong>
            </div>
          </div>

          <p className="permission-note">
            Birleşen masaların tüm siparişleri ve varsa daha önce alınmış kısmi ödemeleri {table.MasaAdi} adisyonuna aktarılır, diğer masalar kapatılır.
          </p>

          <div className="dialog-actions">
            <button disabled={mergeMutation.isPending} onClick={onClose}>
              <ArrowLeft size={15}/> Vazgeç
            </button>
            <button
              className="primary"
              disabled={selectedIds.length===0||mergeMutation.isPending}
              onClick={()=>mergeMutation.mutate()}
            >
              {mergeMutation.isPending?'Birleştiriliyor…':`Masaları birleştir (${money(combinedTotal)})`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ───── KISMİ ÖDEME & POS CİHAZ ENTEGRASYONU MODALI ─────
function PaymentModal({receipt,table,onClose}:{receipt:Receipt;table:Table;onClose:()=>void}){
  const client=useQueryClient();

  const oncekiNakit=receipt.NakitToplam??0;
  const oncekiBanka=receipt.BankaToplam??0;
  const oncekiCari=receipt.CariToplam??0;
  const oncekiYemek=receipt.YemekKartiToplam??0;
  const oncekiIndirim=receipt.IndirimToplam??0;
  const oncekiOdenen=oncekiNakit+oncekiBanka+oncekiCari+oncekiYemek+oncekiIndirim;
  const kalanTutar=Math.max(0,receipt.GenelToplam-oncekiOdenen);

  const [isPartial,setIsPartial]=useState(false);
  const [cash,setCash]=useState(kalanTutar.toFixed(2));
  const [card,setCard]=useState('0');
  const [account,setAccount]=useState('0');
  const [mealCard,setMealCard]=useState('0');
  const [discount,setDiscount]=useState('0');

  // POS State Machine
  const [posDevice,setPosDevice]=useState<PosCihazTipi>(0); // 0=Manuel, 1=Hugin S1, 2=PayGo
  const [posTx,setPosTx]=useState<PosIslemKayit|null>(null);
  const [posBusy,setPosBusy]=useState(false);
  const [posError,setPosError]=useState<string|null>(null);

  const centsCash=toCents(cash);
  const centsCard=toCents(card);
  const centsAccount=toCents(account);
  const centsMealCard=toCents(mealCard);
  const centsDiscount=toCents(discount);

  const allParsed=centsCash!==null&&centsCard!==null&&centsAccount!==null&&centsMealCard!==null&&centsDiscount!==null;
  const centsSum=allParsed?(centsCash+centsCard+centsAccount+centsMealCard+centsDiscount):0;
  const centsKalan=Math.round(kalanTutar*100);

  // Validation
  const validTotal=allParsed&&(isPartial?(centsSum>0&&centsSum<=centsKalan):(centsSum===centsKalan));
  const needsIntegratedPos=centsCard!==null&&centsCard>0&&(posDevice===1||posDevice===2);
  const posApproved=needsIntegratedPos?posTx?.Basarili===true:true;
  const canSubmit=validTotal&&posApproved;

  const quickFill=(type:'cash'|'card'|'mealCard')=>{
    const remaining=kalanTutar.toFixed(2);
    setCash(type==='cash'?remaining:'0');
    setCard(type==='card'?remaining:'0');
    setAccount('0');
    setMealCard(type==='mealCard'?remaining:'0');
    setDiscount('0');
    setPosTx(null);
  };

  const handleStartPos=async()=>{
    if(centsCard===null||centsCard<=0)return;
    setPosBusy(true);
    setPosError(null);
    try{
      const tx=await posIslemBaslat({
        BaslikKayitNo:receipt.KayitNo,
        MasaKayitNo:table.MasaId,
        Tutar:centsCard/100,
        CihazTipi:posDevice
      });
      setPosTx(tx);
    }catch(err:any){
      setPosError(err.message||'POS işlemi başlatılamadı.');
    }finally{
      setPosBusy(false);
    }
  };

  const handleCheckPos=async()=>{
    if(!posTx)return;
    setPosBusy(true);
    try{
      const updated=await posIslemSorgula(posTx.IslemId);
      setPosTx(updated);
    }catch(err:any){
      setPosError(err.message||'POS durumu sorgulanamadı.');
    }finally{
      setPosBusy(false);
    }
  };

  const handleSimulateApprove=async()=>{
    if(!posTx)return;
    setPosBusy(true);
    try{
      const approved=await posIslemSimuleSonuc(posTx.IslemId,true);
      setPosTx(approved);
    }catch(err:any){
      setPosError(err.message||'Simülasyon başarısız.');
    }finally{
      setPosBusy(false);
    }
  };

  const payMutation=useMutation({
    mutationFn:()=>masaOdeme(table.MasaId,{
      BaslikKayitNo:receipt.KayitNo,
      NakitTutar:centsCash!/100,
      BankaTutar:centsCard!/100,
      CariTutar:centsAccount!/100,
      YemekKartiTutar:centsMealCard!/100,
      IndirimTutar:centsDiscount!/100,
      KismiOdeme:isPartial,
      PosIslemId:posTx?.IslemId
    }),
    onSuccess:async()=>{
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal title={`${table.MasaAdi} · Ödeme al`} onClose={()=>{if(!payMutation.isPending)onClose();}}>
      <div className="payment-type-tabs">
        <button
          type="button"
          className={!isPartial?'active':''}
          onClick={()=>{
            setIsPartial(false);
            quickFill('cash');
          }}
        >
          Tam Ödeme (Hesabı Kapat)
        </button>
        <button
          type="button"
          className={isPartial?'active':''}
          onClick={()=>setIsPartial(true)}
        >
          Kısmi Ödeme (Hesap Açık Kalsın)
        </button>
      </div>

      <div className="payment-breakdown-card">
        <div className="payment-breakdown-row">
          <span>Adisyon Toplamı</span>
          <strong>{money(receipt.GenelToplam)}</strong>
        </div>
        {oncekiOdenen>0&&(
          <div className="payment-breakdown-row">
            <span>Daha Önce Ödenen ({[
              oncekiNakit>0?`Nakit: ${money(oncekiNakit)}`:null,
              oncekiBanka>0?`Kart: ${money(oncekiBanka)}`:null,
              oncekiYemek>0?`Yemek: ${money(oncekiYemek)}`:null,
              oncekiCari>0?`Cari: ${money(oncekiCari)}`:null,
              oncekiIndirim>0?`İndirim: ${money(oncekiIndirim)}`:null
            ].filter(Boolean).join(' · ')})</span>
            <strong>{money(oncekiOdenen)}</strong>
          </div>
        )}
        <div className="payment-breakdown-row highlight">
          <span>Kalan Tutar</span>
          <strong>{money(kalanTutar)}</strong>
        </div>
      </div>

      <div className="payment-shortcuts">
        <button type="button" onClick={()=>quickFill('cash')}>
          <Banknote size={15}/> Tamamı nakit
        </button>
        <button type="button" onClick={()=>quickFill('card')}>
          <CreditCard size={15}/> Tamamı kart
        </button>
        <button type="button" onClick={()=>quickFill('mealCard')}>
          Tamamı yemek kartı
        </button>
      </div>

      <div className="payment-fields-grid">
        <label>
          Nakit Tutarı
          <input
            inputMode="decimal"
            value={cash}
            onChange={e=>setCash(e.target.value)}
            disabled={payMutation.isPending}
          />
        </label>
        <label>
          Banka / Kredi Kartı
          <input
            inputMode="decimal"
            value={card}
            onChange={e=>{
              setCard(e.target.value);
              setPosTx(null);
            }}
            disabled={payMutation.isPending}
          />
        </label>
        <label>
          Yemek Kartı (Sodexo / Multinet)
          <input
            inputMode="decimal"
            value={mealCard}
            onChange={e=>setMealCard(e.target.value)}
            disabled={payMutation.isPending}
          />
        </label>
        <label>
          Cari Hesap
          <input
            inputMode="decimal"
            value={account}
            onChange={e=>setAccount(e.target.value)}
            disabled={payMutation.isPending}
          />
        </label>
        <label style={{gridColumn:'1 / -1'}}>
          İndirim Tutarı
          <input
            inputMode="decimal"
            value={discount}
            onChange={e=>setDiscount(e.target.value)}
            disabled={payMutation.isPending}
          />
        </label>
      </div>

      {/* POS Cihaz Entegrasyonu */}
      {centsCard!==null&&centsCard>0&&(
        <div className="pos-section">
          <div className="pos-section-header">
            <h4><CreditCard size={16}/> POS Terminal Entegrasyonu</h4>
            <span className="subtle">{money(centsCard/100)} için</span>
          </div>

          <div className="pos-device-chips">
            <button
              type="button"
              className={posDevice===0?'active':''}
              onClick={()=>{setPosDevice(0);setPosTx(null);}}
            >
              Harici / Manuel POS
            </button>
            <button
              type="button"
              className={posDevice===1?'active':''}
              onClick={()=>{setPosDevice(1);setPosTx(null);}}
            >
              Hugin S1 POS
            </button>
            <button
              type="button"
              className={posDevice===2?'active':''}
              onClick={()=>{setPosDevice(2);setPosTx(null);}}
            >
              PayGo POS
            </button>
          </div>

          {posDevice!==0&&(
            <div className="pos-terminal-state">
              {posError&&<p className="error-text">{posError}</p>}

              {!posTx?(
                <button
                  type="button"
                  className="primary"
                  disabled={posBusy}
                  onClick={handleStartPos}
                >
                  <CreditCard size={15}/> {posDevice===1?'Hugin S1':'PayGo'} Terminaline Gönder ({money(centsCard/100)})
                </button>
              ):(
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span className={`pos-status-badge ${posTx.Basarili?'approved':posTx.Durum===3?'rejected':'waiting'}`}>
                      {posTx.Basarili?<CheckCircle2 size={14}/>:posTx.Durum===3?<AlertCircle size={14}/>:<RefreshCw size={14} className="spin"/>}
                      {posTx.Basarili?'Onaylandı':posTx.Durum===1?'Cihaza Gönderildi':posTx.Durum===3?'Reddedildi':'Beklemede'}
                    </span>
                    <small className="subtle">ID: {posTx.IslemId.substring(0,8)}</small>
                  </div>

                  <div className="pos-terminal-details">
                    {posTx.Basarili?(
                      <>
                        <span>Kart: <code>{posTx.MaskedPan}</code></span>
                        <span>Onay Kodu: <code>{posTx.AuthCode}</code> · RRN: <code>{posTx.Rrn}</code></span>
                      </>
                    ):(
                      <span>Terminalden kart çekilmesi veya temassız okutulması bekleniyor…</span>
                    )}
                  </div>

                  <div className="pos-actions-bar">
                    {!posTx.Basarili&&(
                      <>
                        <button type="button" className="secondary" disabled={posBusy} onClick={handleCheckPos}>
                          <RefreshCw size={13}/> Durum Sorgula
                        </button>
                        <button type="button" className="secondary" disabled={posBusy} onClick={handleSimulateApprove}>
                          <CheckCircle2 size={13}/> Terminal Onay Simülasyonu
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <ErrorBox error={payMutation.error}/>

      {!validTotal&&(
        <p role="status" className="error-text">
          {isPartial
            ?'Kısmi ödeme tutarı 0\'dan büyük ve kalan tutardan küçük veya eşit olmalıdır.'
            :`Girilen ödemeler toplamı (${money(centsSum/100)}) kalan tutarla (${money(kalanTutar)}) tam eşleşmelidir.`}
        </p>
      )}

      {needsIntegratedPos&&!posTx?.Basarili&&(
        <p role="status" className="error-text">
          Entegre POS seçildiğinde ödemeyi tamamlamadan önce POS terminal onayının alınması zorunludur.
        </p>
      )}

      <div className="dialog-actions">
        <button disabled={payMutation.isPending} onClick={onClose}>
          <ArrowLeft size={15}/> Vazgeç
        </button>
        <button
          className="primary"
          disabled={!canSubmit||payMutation.isPending}
          onClick={()=>payMutation.mutate()}
        >
          {payMutation.isPending?'Kaydediliyor…':isPartial?'Kısmi ödemeyi kaydet':'Ödemeyi tamamla'}
        </button>
      </div>
    </Modal>
  );
}
