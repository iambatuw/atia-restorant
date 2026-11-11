import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  ReceiptText,
  Search,
  Split,
  GitMerge,
  MoveRight,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type {Category,OrderLine,Product,Receipt,Section,Session,Table,PosCihazTipi,PosIslemKayit} from './types';
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
import {tablePath,tableRouteFromPath} from './routes';

export function Tables({session,path,navigate}:{session:Session;path:string;navigate:(path:string)=>void}){
  const tables=useQuery({queryKey:['tables'],queryFn:()=>api<Table[]>('/masalar'),refetchInterval:15000});
  const sections=useQuery({queryKey:['sections'],queryFn:()=>api<Section[]>('/bolumler'),refetchInterval:15000});
  const [section,setSection]=useState<number|null>(null);
  const [status,setStatus]=useState('all');
  const [search,setSearch]=useState('');
  const [pickerTable,setPickerTable]=useState<number|null>(null);
  const selectedRoute=tableRouteFromPath(path);
  const selected=selectedRoute?.tableId??null;
  const picker=!!selectedRoute?.picker||(selected!==null&&pickerTable===selected);

  const table=tables.data?.find(t=>t.MasaId===selected);
  const visible=(tables.data??[]).filter(t=>
    (section===null||t.RestorantBolumuKayitNo===section)&&
    (status==='all'||(status==='busy'?!!t.BaslikKayitNo:status==='reserved'?t.Rezerve:!t.BaslikKayitNo&&!t.Rezerve))&&
    t.MasaAdi.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))
  );
  const occupied=tables.data?.filter(t=>!!t.BaslikKayitNo).length??0;
  const available=tables.data?.filter(t=>!t.BaslikKayitNo&&!t.Rezerve).length??0;

  if (selected!==null&&!table) return (
    <section className="op-page"><ErrorBox error={tables.error} retry={()=>void tables.refetch()}/>{tables.isPending?<Loading/>:!tables.error&&<Empty>Masa bulunamadı. <button className="secondary" onClick={()=>navigate('/app/masalar')}>Masalara dön</button></Empty>}</section>
  );
  return (
    <section className={`op-page op-floor-page ${table?'has-table':''}`} aria-label="Masalar">
      <header className="op-page-head"><div><h1>Masalar</h1><p>Salonun anlık durumu ve açık adisyonlar</p></div><div className="op-head-count"><strong>{occupied}</strong><span>dolu</span><strong>{available}</strong><span>boş</span></div></header>
      <div className={`op-floor-layout ${table?'has-selection':''}`}>
        <section className="op-floor">
          <div className="op-floor-tools">
            <div className="op-sections" role="group" aria-label="Bölümler">
              <button aria-pressed={section===null} onClick={()=>setSection(null)}>Tüm bölümler <span>{tables.data?.length??0}</span></button>
              {sections.data?.map(s=><button key={s.KayitNo} aria-pressed={section===s.KayitNo} onClick={()=>setSection(s.KayitNo)}>{s.BolumAdi} <span>{s.ToplamMasa}</span></button>)}
            </div>
            <div className="op-floor-filters"><div className="op-filter-set" role="group" aria-label="Masa durumu">
              {[['all','Tümü'],['busy','Dolu'],['free','Boş'],['reserved','Rezerve']].map(([id,label])=><button key={id} aria-pressed={status===id} onClick={()=>setStatus(id)}>{label}</button>)}
            </div><label className="op-search"><Search size={17}/><input type="search" placeholder="Masa ara" aria-label="Masa ara" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
          </div>
          <ErrorBox error={tables.error||sections.error} retry={()=>{void tables.refetch();void sections.refetch();}}/>
          {tables.isPending?<Loading/>:visible.length===0?<Empty>Bu filtreye uygun masa yok.</Empty>:(
            <div className="op-table-grid">
              {visible.map(t=>{
                const mins=minutes(t.AcilisTarihi);
                return (
                  <button
                    className={`op-table ${t.BaslikKayitNo?'occupied':t.Rezerve?'reserved':'free'}`}
                    key={t.MasaId}
                    onClick={()=>navigate(tablePath(t.MasaId))}
                    aria-pressed={selected===t.MasaId}
                  >
                    <span className="op-table-top"><span>{t.RestorantBolumAdi}</span><span className="op-table-status">{t.BaslikKayitNo?'Dolu':t.Rezerve?'Rezerve':'Boş'}</span></span>
                    <strong className="op-table-name">{t.MasaAdi}</strong>
                    <span className="op-table-bottom"><span>{t.BaslikKayitNo?`${t.KisiSayisi} kişi · ${mins} dk`:t.Rezerve?'Rezervasyonlu':'Adisyon açılabilir'}</span><b>{t.BaslikKayitNo?money(t.Tutar):'—'}</b></span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        {table?(
          <TableOrder key={table.MasaId} table={table} admin={session.Rol==='Admin'} allTables={tables.data??[]}
            close={()=>{setPickerTable(null);navigate('/app/masalar');}} picker={picker}
            onOpenPicker={()=>setPickerTable(table.MasaId)}
            onClosePicker={()=>{setPickerTable(null);if(selectedRoute?.picker)navigate(tablePath(table.MasaId));}}/>
        ):(
          <aside className="op-check-placeholder"><ReceiptText size={28}/><h2>Adisyon</h2><p>Siparişleri görmek veya yeni adisyon açmak için bir masa seçin.</p></aside>
        )}
      </div>
    </section>
  );
}

function minutes(date:string|null){
  return date?Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000)):0;
}

function TableOrder({table,admin,allTables,close,picker,onOpenPicker,onClosePicker}:{table:Table;admin:boolean;allTables:Table[];close:()=>void;picker:boolean;onOpenPicker:()=>void;onClosePicker:()=>void}){
  const client=useQueryClient();
  const [payment,setPayment]=useState(false);
  const [transfer,setTransfer]=useState(false);
  const [split,setSplit]=useState(false);
  const [merge,setMerge]=useState(false);
  const [cancel,setCancel]=useState<OrderLine|null>(null);
  const [removalReason,setRemovalReason]=useState('');
  const [removalType,setRemovalType]=useState<0|1>(0);

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
    <>
    <aside className="order-panel guest-check-panel fresh-check">
      <header className="fresh-check-heading">
        <div>
          <p>{table.RestorantBolumAdi}</p>
          <h2>{table.MasaAdi}</h2>
          <span>{order?`Adisyon #${order.KayitNo}`:'Yeni adisyon'}{table.AcilisTarihi?` · ${minutes(table.AcilisTarihi)} dk`:''}</span>
        </div>
        <button className="icon-button" onClick={close} aria-label="Masalara dön"><ArrowLeft size={20}/></button>
      </header>

      <ErrorBox error={receipt.error||mutation.error} retry={()=>void receipt.refetch()}/>

      <div className="order-lines-container">
        {receipt.isPending?(
          <Loading/>
        ):!order||order.Detaylar.length===0?(
          <div className="empty-order-card">
            <ReceiptText size={32} strokeWidth={1.3}/>
            <p>Bu masada henüz sipariş bulunmuyor.<br/>Aşağıdaki butona dokunarak menüden ürün ekleyin.</p>
          </div>
        ):(
          <div className="order-lines-list">
            {order.Detaylar.map(line=>(
              <div className="order-item-row" key={line.KayitNo}>
                <div className="item-row-top">
                  <div className="item-qty-badge">{line.Miktar}×</div>
                  <strong className="item-name">{line.StokAdi}{line.PorsiyonAdi?` · ${line.PorsiyonAdi}`:''}</strong>
                  <strong className="item-sum">{money(line.SatirTutari)}</strong>
                </div>

                {line.SatirAciklama&&(
                  <div className="item-note-tag">
                    <span>Not: {line.SatirAciklama}</span>
                  </div>
                )}

                <div className="item-row-bottom">
                  <span className="unit-price">{line.Ikram?'İkram':`${money(line.BirimFiyat)} / adet`}</span>
                  {admin&&<button type="button" disabled={busy} onClick={()=>mutation.mutate({path:`/siparisler/${line.KayitNo}`,method:'PATCH',body:{DetayKayitNo:line.KayitNo,Miktar:line.Miktar,SatirAciklama:line.SatirAciklama,Ikram:!line.Ikram}})}>{line.Ikram?'İkramı kaldır':'İkram et'}</button>}
                  <div className="item-stepper">
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${line.StokAdi}${line.PorsiyonAdi?` ${line.PorsiyonAdi}`:''} adet azalt`}
                      onClick={()=>change(line,-1)}
                    >
                      <Minus size={13}/>
                    </button>
                    <span className="stepper-val">{line.Miktar}</span>
                    <button
                      type="button"
                      disabled={busy||(!admin&&line.Ikram)}
                      aria-label={`${line.StokAdi}${line.PorsiyonAdi?` ${line.PorsiyonAdi}`:''} adet artır`}
                      onClick={()=>change(line,1)}
                    >
                      <Plus size={13}/>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="item-delete-btn"
                    aria-label={`${line.StokAdi}${line.PorsiyonAdi?` ${line.PorsiyonAdi}`:''} için iptal veya zayi kaydet`}
                    onClick={()=>setCancel(line)}
                    title="İptal veya zayi kaydet"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="order-slip-footer">
        <button
          type="button"
          className="add-dish-btn"
          disabled={busy||receipt.isPending||!!receipt.error}
          onClick={()=>{mutation.reset();onOpenPicker();}}
        >
          <Plus size={17}/> <span>Menüden Ürün Ekle</span>
        </button>

        {order&&(
          <div className="receipt-calc-table">
            <div className="calc-row grand-total">
              <span className="grand-label">Ödenecek Tutar</span>
              <strong className="grand-val">{money(order.GenelToplam)}</strong>
            </div>
          </div>
        )}

        {admin?(
          <div className="pos-actions-block">
            <button
              type="button"
              className="primary full pay-action-btn"
              disabled={!order||order.Detaylar.length===0||busy}
              onClick={()=>setPayment(true)}
            >
              <CreditCard size={18}/>
              <span>Hesabı Kapat / Ödeme Al</span>
              <ArrowRight size={17}/>
            </button>

            <div className="table-ops-grid">
              <button
                type="button"
                className="secondary"
                disabled={!order||busy}
                onClick={()=>setTransfer(true)}
                title="Adisyonu başka masaya taşı"
              >
                <MoveRight size={14}/> <span>Taşı</span>
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!order||order.Detaylar.length<=1||busy}
                onClick={()=>setSplit(true)}
                title="Siparişleri bölerek yeni masaya aktar"
              >
                <Split size={14}/> <span>Ayır</span>
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!order||busy}
                onClick={()=>setMerge(true)}
                title="Diğer açık masaları bu masaya topla"
              >
                <GitMerge size={14}/> <span>Birleştir</span>
              </button>
            </div>
          </div>
        ):(
          <p className="permission-note">Ödeme ve masa transfer yetkisi yönetici rolüne aittir.</p>
        )}
      </div>

      {cancel&&(
        <Modal title="Ürünü adisyondan çıkar" onClose={()=>{if(!busy)setCancel(null);}}>
          <p><strong>{cancel.StokAdi}</strong> ({cancel.Miktar} adet) için işlem türünü ve gerekçeyi kaydedin.</p>
          <div className="op-removal-types" role="group" aria-label="Çıkarma türü"><button type="button" aria-pressed={removalType===0} onClick={()=>setRemovalType(0)}>İptal</button>{admin&&<button type="button" aria-pressed={removalType===1} onClick={()=>setRemovalType(1)}>Zayi</button>}</div>
          <label className="field">Gerekçe<input value={removalReason} maxLength={200} onChange={e=>setRemovalReason(e.target.value)} placeholder="Örn. müşteri vazgeçti"/></label>
          <ErrorBox error={mutation.error}/>
          <div className="dialog-actions">
            <button disabled={busy} onClick={()=>setCancel(null)}>Vazgeç</button>
            <button className="danger" disabled={busy||!removalReason.trim()} onClick={()=>mutation.mutate({path:`/siparisler/${cancel.KayitNo}/cikar`,method:'POST',body:{Tip:removalType,Gerekce:removalReason.trim()}},{onSuccess:()=>{setCancel(null);setRemovalReason('');setRemovalType(0);}})}>
              {removalType===1?'Zayi kaydet':'İptal et'}
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
    {picker&&<TableProductPicker table={table} onClose={onClosePicker}/>}
    </>
  );
}

function TableProductPicker({table,onClose}:{table:Table;onClose:()=>void}){
  const client=useQueryClient();
  const menu=useQuery({queryKey:['menu','public'],queryFn:()=>api<Category[]>('/menu')});
  const [category,setCategory]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [note,setNote]=useState('');
  const [portionProduct,setPortionProduct]=useState<Product|null>(null);
  const [added,setAdded]=useState(0);
  const [lastAdded,setLastAdded]=useState('');
  const add=useMutation({
    mutationFn:({product,portionId,amount,orderNote}:{product:Product;portionId?:number;amount:number;orderNote:string})=>
      api('/siparisler',{method:'POST',body:JSON.stringify({MasaKayitNo:table.MasaId,StokKayitNo:product.KayitNo,
        PorsiyonKayitNo:portionId,Miktar:amount,SatirAciklama:orderNote})}),
    onSuccess:async(_,item)=>{
      setAdded(count=>count+item.amount);
      setLastAdded(`${item.amount} × ${item.product.StokAdi} adisyona eklendi`);
      setPortionProduct(null);
      setNote('');
      setQuantity(1);
      await client.invalidateQueries({queryKey:['receipt',table.MasaId]});
      await client.invalidateQueries({queryKey:['tables']});
    }
  });
  const categories=menu.data??[];
  const query=search.trim().toLocaleLowerCase('tr');
  const products=categories.filter(item=>category===null||item.KayitNo===category)
    .flatMap(item=>item.Urunler)
    .filter(product=>product.StokAdi.toLocaleLowerCase('tr').includes(query));
  const select=(product:Product,portionId?:number)=>{
    if(add.isPending)return;
    add.reset();
    setLastAdded('');
    if(product.Porsiyonlar.length>0&&portionId===undefined){setPortionProduct(product);return;}
    add.mutate({product,portionId,amount:quantity,orderNote:note.trim()});
  };

  return <Modal title={`${table.MasaAdi} · Ürün ekle`} className="table-product-dialog" onClose={onClose} preventClose={add.isPending}>
    <div className="table-product-meta"><span>{table.RestorantBolumAdi} masası</span><span>Ürünlere dokunarak adisyona ekleyin</span></div>
    <div className="table-product-tools">
      <label className="table-product-search"><Search size={20}/><input type="search" placeholder="Ürün ara" aria-label="Ürün ara" value={search} onChange={event=>{setSearch(event.target.value);setPortionProduct(null);}}/></label>
      <div className="table-product-categories" role="group" aria-label="Ürün kategorileri">
        <button type="button" aria-pressed={category===null} onClick={()=>{setCategory(null);setPortionProduct(null);}}>Tümü</button>
        {categories.map(item=><button type="button" key={item.KayitNo} aria-pressed={category===item.KayitNo} onClick={()=>{setCategory(item.KayitNo);setPortionProduct(null);}}>{item.GrupAdi}</button>)}
      </div>
      <div className="table-product-options">
        <label>Sıradaki ürün için not<input maxLength={250} value={note} onChange={event=>setNote(event.target.value)} placeholder="Örn. soğansız, az pişmiş"/></label>
        <div className="table-product-quantity" role="group" aria-label="Eklenecek adet"><span>Adet</span><button type="button" aria-label="Adedi azalt" disabled={quantity===1||add.isPending} onClick={()=>setQuantity(value=>value-1)}><Minus size={19}/></button><strong>{quantity}</strong><button type="button" aria-label="Adedi artır" disabled={quantity===50||add.isPending} onClick={()=>setQuantity(value=>value+1)}><Plus size={19}/></button></div>
      </div>
    </div>
    <ErrorBox error={menu.error||add.error} retry={menu.error?()=>void menu.refetch():undefined}/>
    {portionProduct&&<section className="table-product-portions" aria-label={`${portionProduct.StokAdi} porsiyonları`}>
      <div><strong>{portionProduct.StokAdi}</strong><span>Porsiyon seçin</span></div>
      <div>{portionProduct.Porsiyonlar.map(portion=><button type="button" key={portion.KayitNo} disabled={add.isPending} onClick={()=>select(portionProduct,portion.KayitNo)}><span>{portion.PorsiyonAdi}</span><b>{money(portion.Fiyat)}</b></button>)}</div>
      <button type="button" className="table-product-portions-cancel" onClick={()=>setPortionProduct(null)}>Vazgeç</button>
    </section>}
    <div className="table-product-catalog" aria-label="Menü ürünleri">
      {menu.isPending?<Loading/>:products.length===0?<Empty>Bu aramada ürün bulunamadı.</Empty>:
        <div className="table-product-grid">{products.map(product=><button type="button" key={product.KayitNo} className="table-product-card" aria-pressed={portionProduct?.KayitNo===product.KayitNo} disabled={add.isPending} onClick={()=>select(product)}><span>{product.GrupAdi}</span><strong>{product.StokAdi}</strong><span className="table-product-card-bottom"><b>{money(product.SatisFiyati)}</b><Plus size={21} aria-hidden="true"/></span>{product.Porsiyonlar.length>0&&<small>{product.Porsiyonlar.length} porsiyon seçeneği</small>}</button>)}</div>}
    </div>
    <div className="table-product-footer"><span role="status" aria-live="polite">{add.isPending?'Sipariş ekleniyor…':lastAdded||`${products.length} ürün · ${added} adet eklendi`}</span><button type="button" className="primary" disabled={add.isPending} onClick={onClose}>Adisyona dön</button></div>
  </Modal>;
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
                      <strong>{line.StokAdi}{line.PorsiyonAdi?` · ${line.PorsiyonAdi}`:''}</strong>
                      <small>{line.Miktar} adet mevcut · {line.Ikram?'İkram':money(line.BirimFiyat)}</small>
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
