import {useRef,useState} from 'react';
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
  RefreshCw,
  Printer,
  FileText,
  ScanLine,
  UsersRound
} from 'lucide-react';
import type {Account,Category,FullSettings,MealCard,OrderLine,Product,Receipt,ReceiptLocation,Section,Session,Table,PosCihazTipi,PosIslemKayit} from './types';
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
import {BillPrint} from './Barcode';
import {InvoiceDetailsDialog} from './InvoiceDetails';
import {OptionChooser} from './Options';
import {SplitPaymentPanel} from './PaymentSplit';
import './Extensions.css';

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
            </div><label className="op-search"><Search size={17}/><input type="search" placeholder="Masa ara" aria-label="Masa ara" value={search} onChange={e=>setSearch(e.target.value)}/></label><ReceiptLookup navigate={navigate}/></div>
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

/** Opens a receipt by number: typed by hand or read from the barcode on a printed bill. */
function ReceiptLookup({navigate}:{navigate:(path:string)=>void}){
  const [value,setValue]=useState('');
  const [message,setMessage]=useState('');
  const lookup=useMutation({
    mutationFn:(id:number)=>api<ReceiptLocation>(`/adisyonlar/${id}/konum`),
    onSuccess:found=>{
      setValue('');
      if(!found.Kapali&&found.MasaKayitNo){setMessage('');navigate(tablePath(found.MasaKayitNo));}
      else setMessage(`Adisyon #${found.KayitNo} kapalı (${found.MasaAdi??'masa yok'}). Geçmişi Adisyonlar ekranında görebilirsiniz.`);
    },
    onError:error=>setMessage(error instanceof Error?error.message:'Adisyon bulunamadı.')
  });
  const submit=()=>{const digits=value.replace(/\D/g,'');if(digits)lookup.mutate(Number(digits));};
  return <div className="op-lookup">
    <label className="op-search"><ScanLine size={17}/><input inputMode="numeric" placeholder="Adisyon no / barkod" aria-label="Adisyon numarası veya barkod" value={value}
      onChange={e=>{setValue(e.target.value);setMessage('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}}}/></label>
    {message&&<span className="op-note" role="status">{message}</span>}
  </div>;
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
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const wasteEnabled=admin&&settings.data?.ZayiAktif===true;
  const [printing,setPrinting]=useState(false);
  const [invoice,setInvoice]=useState(false);
  const effectiveRemovalType=wasteEnabled?removalType:0;

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
  const printMark=useMutation({
    mutationFn:(id:number)=>api<Receipt>(`/adisyonlar/${id}/yazdirildi`,{method:'POST'}),
    onSuccess:()=>{setPrinting(true);void client.invalidateQueries({queryKey:['tables']});}
  });

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

      <ErrorBox error={receipt.error||mutation.error||settings.error} retry={()=>{void receipt.refetch();void settings.refetch();}}/>

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
                  <strong className="item-name">{line.StokAdi}{line.PorsiyonAdi?` · ${line.PorsiyonAdi}`:''}{line.SecimMetni&&<span className="op-line-choice">{line.SecimMetni}</span>}</strong>
                  <strong className="item-sum">{money(line.SatirTutari)}</strong>
                </div>
                {(line.OdenenMiktar??0)>0&&<span className="op-paid-tag">{line.OdenenMiktar} adet ödendi</span>}

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
                      disabled={busy||line.Miktar-1<(line.OdenenMiktar??0)}
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
                    disabled={busy||(line.OdenenMiktar??0)>0}
                    className="item-delete-btn"
                    aria-label={`${line.StokAdi}${line.PorsiyonAdi?` ${line.PorsiyonAdi}`:''} için ${wasteEnabled?'iptal veya zayi kaydet':'iptal et'}`}
                    onClick={()=>setCancel(line)}
                    title={wasteEnabled?'İptal veya zayi kaydet':'Ürünü iptal et'}
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
          <div className="op-bill-summary">
            <div className="op-bill-total">
              <span>Ödenecek tutar</span>
              <strong>{money(order.GenelToplam)}</strong>
            </div>
            <div className="op-bill-tools">
              <div className="op-guest-pill" role="group" aria-label="Kişi sayısı">
                <button type="button" aria-label="Kişi sayısını azalt" disabled={busy||order.KisiSayisi<=1}
                  onClick={()=>mutation.mutate({path:`/masalar/${table.MasaId}/kisi-sayisi`,method:'PATCH',body:{KisiSayisi:order.KisiSayisi-1}})}><Minus size={14}/></button>
                <span><UsersRound size={14}/><strong>{order.KisiSayisi}</strong> kişi</span>
                <button type="button" aria-label="Kişi sayısını artır" disabled={busy||order.KisiSayisi>=50}
                  onClick={()=>mutation.mutate({path:`/masalar/${table.MasaId}/kisi-sayisi`,method:'PATCH',body:{KisiSayisi:order.KisiSayisi+1}})}><Plus size={14}/></button>
              </div>
              <button type="button" className="op-bill-tool" disabled={busy||printMark.isPending||order.Detaylar.length===0}
                onClick={()=>printMark.mutate(order.KayitNo)} title="Müşteriye bilgi fişi yazdır" aria-label="Adisyonu yazdır">
                <Printer size={15}/><span>Yazdır</span>
              </button>
              <button type="button" className={`op-bill-tool ${order.FaturaBilgisi?'is-set':''}`} disabled={busy} onClick={()=>setInvoice(true)}
                title="Fişe firma bilgisi yaz" aria-label={order.FaturaBilgisi?'Fatura bilgisi girildi':'Fatura bilgisi'}>
                <FileText size={15}/><span>{order.FaturaBilgisi?'Fatura ✓':'Fatura'}</span>
              </button>
            </div>
          </div>
        )}
        <ErrorBox error={printMark.error}/>

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
          <div className="op-removal-types" role="group" aria-label="Çıkarma türü"><button type="button" aria-pressed={effectiveRemovalType===0} onClick={()=>setRemovalType(0)}>İptal</button>{wasteEnabled&&<button type="button" aria-pressed={effectiveRemovalType===1} onClick={()=>setRemovalType(1)}>Zayi</button>}</div>
          <label className="field">Gerekçe<input value={removalReason} maxLength={200} onChange={e=>setRemovalReason(e.target.value)} placeholder="Örn. müşteri vazgeçti"/></label>
          <ErrorBox error={mutation.error}/>
          <div className="dialog-actions">
            <button disabled={busy} onClick={()=>setCancel(null)}>Vazgeç</button>
            <button className="danger" disabled={busy||!removalReason.trim()} onClick={()=>mutation.mutate({path:`/siparisler/${cancel.KayitNo}/cikar`,method:'POST',body:{Tip:effectiveRemovalType,Gerekce:removalReason.trim()}},{onSuccess:()=>{setCancel(null);setRemovalReason('');setRemovalType(0);}})}>
              {effectiveRemovalType===1?'Zayi kaydet':'İptal et'}
            </button>
          </div>
        </Modal>
      )}

      {payment&&order&&(
        <PaymentModal receipt={order} table={table} mealCards={settings.data?.YemekKartlari??[]} onClose={()=>setPayment(false)}/>
      )}
      {invoice&&order&&<InvoiceDetailsDialog receipt={order} admin={admin} close={()=>setInvoice(false)}/>}
      {printing&&order&&<BillPrint receipt={order} store={settings.data?.Isletme} onDone={()=>setPrinting(false)}/>}

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

type DraftProduct={id:number;product:Product;portionId?:number;portionName?:string;amount:number;note:string;options:number[];optionText:string};

/** Adds or removes a quick note (comma separated) without touching the rest of the typed note. */
export function toggleQuickNote(note:string,quick:string):string{
  const parts=note.split(',').map(part=>part.trim()).filter(Boolean);
  const has=parts.some(part=>part.toLocaleLowerCase('tr')===quick.toLocaleLowerCase('tr'));
  return (has?parts.filter(part=>part.toLocaleLowerCase('tr')!==quick.toLocaleLowerCase('tr')):[...parts,quick]).join(', ');
}

function TableProductPicker({table,onClose}:{table:Table;onClose:()=>void}){
  const client=useQueryClient();
  const menu=useQuery({queryKey:['menu','public'],queryFn:()=>api<Category[]>('/menu')});
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const [optionTarget,setOptionTarget]=useState<{product:Product;portionId?:number}|null>(null);
  const [simpleTarget,setSimpleTarget]=useState<{product:Product;portionId?:number}|null>(null);
  const [category,setCategory]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [note,setNote]=useState('');
  const [portionProduct,setPortionProduct]=useState<Product|null>(null);
  const [draft,setDraft]=useState<DraftProduct[]>([]);
  const [added,setAdded]=useState(0);
  const [lastAdded,setLastAdded]=useState('');
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const nextDraftId=useRef(0);
  const selectedProduct=optionTarget?.product??portionProduct??simpleTarget?.product;
  const quickNotes=(settings.data?.HazirNotlar??[]).filter(item=>selectedProduct?.HazirNotlar?.some(note=>note.toLocaleLowerCase('tr')===item.toLocaleLowerCase('tr')));
  const confirm=useMutation({
    mutationFn:(lines:DraftProduct[])=>api<Receipt>('/siparisler/toplu',{
      method:'POST',body:JSON.stringify({MasaKayitNo:table.MasaId,Satirlar:lines.map(line=>({
        MasaKayitNo:table.MasaId,StokKayitNo:line.product.KayitNo,PorsiyonKayitNo:line.portionId,
        Miktar:line.amount,SatirAciklama:line.note,SecenekKayitNolar:line.options
      }))})
    }),
    onSuccess:async(_,lines)=>{
      await Promise.all([
        client.invalidateQueries({queryKey:['receipt',table.MasaId]}),
        client.invalidateQueries({queryKey:['tables']})
      ]);
      const amount=lines.reduce((total,line)=>total+line.amount,0);
      setAdded(total=>total+amount);
      setLastAdded(`${amount} adet adisyona eklendi. Yeni ürün seçebilirsiniz.`);
      setDraft([]);
      setConfirmDiscard(false);
    }
  });
  const categories=menu.data??[];
  const query=search.trim().toLocaleLowerCase('tr');
  const products=categories.filter(item=>category===null||item.KayitNo===category)
    .flatMap(item=>item.Urunler)
    .filter(product=>product.StokAdi.toLocaleLowerCase('tr').includes(query));
  const addToDraft=(product:Product,portionId?:number,options:number[]=[])=>{
    if(confirm.isPending||draft.length>=50)return;
    confirm.reset();
    setConfirmDiscard(false);
    setLastAdded('');
    const portion=product.Porsiyonlar.find(item=>item.KayitNo===portionId);
    const chosen=(product.SecenekGruplari??[]).flatMap(group=>group.Secenekler).filter(option=>options.includes(option.KayitNo));
    setDraft(lines=>[...lines,{id:++nextDraftId.current,product,portionId,portionName:portion?.PorsiyonAdi,amount:quantity,note:note.trim(),
      options:chosen.map(option=>option.KayitNo),optionText:chosen.map(option=>option.Ad).join(', ')}]);
    setPortionProduct(null);
    setOptionTarget(null);
    setSimpleTarget(null);
    setNote('');
    setQuantity(1);
  };
  const chooseProduct=(product:Product)=>{
    if(confirm.isPending||draft.length>=50)return;
    setNote('');
    setQuantity(1);
    setSimpleTarget(null);
    setOptionTarget(null);
    setPortionProduct(null);
    if(product.Porsiyonlar.length>0)setPortionProduct(product);
    else if(product.SecenekGruplari?.length)setOptionTarget({product});
    else setSimpleTarget({product});
  };
  const choosePortion=(product:Product,portionId:number)=>{
    setPortionProduct(null);
    if(product.SecenekGruplari?.length)setOptionTarget({product,portionId});
    else setSimpleTarget({product,portionId});
  };
  const scanBarcode=()=>{
    const code=search.trim();
    const match=code?categories.flatMap(item=>item.Urunler).find(product=>product.Barkod&&product.Barkod.toLocaleLowerCase('tr')===code.toLocaleLowerCase('tr')):undefined;
    if(match){setSearch('');chooseProduct(match);}
  };
  const draftAmount=draft.reduce((total,line)=>total+line.amount,0);
  const closePicker=()=>{
    if(draft.length>0){setConfirmDiscard(true);return;}
    onClose();
  };

  return <Modal title={`${table.MasaAdi} · Ürün ekle`} className="table-product-dialog" onClose={closePicker} preventClose={confirm.isPending}>
    <div className="table-product-meta"><span>{table.RestorantBolumAdi} masası</span><span>Ürünleri seçin, sonra onaylayın</span></div>
    <div className="table-product-tools">
      <label className="table-product-search"><Search size={20}/><input type="search" placeholder="Ürün ara veya barkod okutun" aria-label="Ürün ara veya barkod okutun" value={search} onChange={event=>{setSearch(event.target.value);setPortionProduct(null);setOptionTarget(null);setSimpleTarget(null);setNote('');}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();scanBarcode();}}}/></label>
      <div className="table-product-categories" role="group" aria-label="Ürün kategorileri">
        <button type="button" aria-pressed={category===null} onClick={()=>{setCategory(null);setPortionProduct(null);setOptionTarget(null);setSimpleTarget(null);setNote('');}}>Tümü</button>
        {categories.map(item=><button type="button" key={item.KayitNo} aria-pressed={category===item.KayitNo} onClick={()=>{setCategory(item.KayitNo);setPortionProduct(null);setOptionTarget(null);setSimpleTarget(null);setNote('');}}>{item.GrupAdi}</button>)}
      </div>
    </div>
    <ErrorBox error={menu.error||confirm.error} retry={menu.error?()=>void menu.refetch():undefined}/>
    {selectedProduct&&<section className="table-product-selection" aria-label={`${selectedProduct.StokAdi} seçimi`}>
      <div className="table-product-selection-row">
        {simpleTarget&&<div className="table-product-selection-name"><strong>{simpleTarget.product.StokAdi}</strong>{simpleTarget.portionId&&<span>{simpleTarget.product.Porsiyonlar.find(item=>item.KayitNo===simpleTarget.portionId)?.PorsiyonAdi}</span>}</div>}
        <input className="table-product-note" maxLength={250} value={note} onChange={event=>setNote(event.target.value)} placeholder={simpleTarget?'Not (isteğe bağlı)':`${selectedProduct.StokAdi} için not (isteğe bağlı)`} aria-label={`${selectedProduct.StokAdi} için not`}/>
        <div className="table-product-quantity" role="group" aria-label="Seçilecek adet"><span>Adet</span><button type="button" aria-label="Adedi azalt" disabled={quantity===1||confirm.isPending} onClick={()=>setQuantity(value=>value-1)}><Minus size={17}/></button><strong>{quantity}</strong><button type="button" aria-label="Adedi artır" disabled={quantity===50||confirm.isPending} onClick={()=>setQuantity(value=>value+1)}><Plus size={17}/></button></div>
        {simpleTarget&&<div className="table-product-selection-actions"><button type="button" className="secondary" onClick={()=>{setSimpleTarget(null);setNote('');}}>Vazgeç</button><button type="button" className="primary" disabled={confirm.isPending||draft.length>=50} onClick={()=>addToDraft(simpleTarget.product,simpleTarget.portionId)}>Seçime ekle</button></div>}
      </div>
      {quickNotes.length>0&&<div className="op-chip-row table-product-quick-notes" role="group" aria-label={`${selectedProduct.StokAdi} için hazır notlar`}>{quickNotes.map(item=><button type="button" key={item} className="op-chip"
        aria-pressed={note.split(',').some(part=>part.trim().toLocaleLowerCase('tr')===item.toLocaleLowerCase('tr'))}
        onClick={()=>setNote(current=>toggleQuickNote(current,item).slice(0,250))}>{item}</button>)}</div>}
      {portionProduct&&<section className="table-product-portions" aria-label={`${portionProduct.StokAdi} porsiyonları`}>
        <div><strong>{portionProduct.StokAdi}</strong><span>Porsiyon seçin</span></div>
         <div>{portionProduct.Porsiyonlar.map(portion=><button type="button" key={portion.KayitNo} disabled={confirm.isPending||draft.length>=50} onClick={()=>choosePortion(portionProduct,portion.KayitNo)}><span>{portion.PorsiyonAdi}</span><b>{money(portion.Fiyat)}</b></button>)}</div>
        <button type="button" className="table-product-portions-cancel" onClick={()=>setPortionProduct(null)}>Vazgeç</button>
      </section>}
      {optionTarget&&<OptionChooser key={`${optionTarget.product.KayitNo}-${optionTarget.portionId??0}`} product={optionTarget.product}
        basePrice={optionTarget.product.Porsiyonlar.find(item=>item.KayitNo===optionTarget.portionId)?.Fiyat??optionTarget.product.SatisFiyati}
         disabled={confirm.isPending||draft.length>=50} onCancel={()=>{setOptionTarget(null);setNote('');}} onConfirm={ids=>addToDraft(optionTarget.product,optionTarget.portionId,ids)}/>}
    </section>}
    <div className="table-product-catalog" aria-label="Menü ürünleri">
      {menu.isPending?<Loading/>:products.length===0?<Empty>Bu aramada ürün bulunamadı.</Empty>:
        <div className="table-product-grid">{products.map(product=><button type="button" key={product.KayitNo} className="table-product-card" aria-pressed={selectedProduct?.KayitNo===product.KayitNo} disabled={confirm.isPending||draft.length>=50} onClick={()=>chooseProduct(product)}><span>{product.GrupAdi}</span><strong>{product.StokAdi}</strong><span className="table-product-card-bottom"><b>{money(product.SatisFiyati)}</b><Plus size={21} aria-hidden="true"/></span>{product.Porsiyonlar.length>0&&<small>{product.Porsiyonlar.length} porsiyon seçeneği</small>}{(product.SecenekGruplari?.length??0)>0&&<small>{product.SecenekGruplari!.some(group=>group.Zorunlu)?'Seçim gerekli':'Ekstra seçenekli'}</small>}</button>)}</div>}
    </div>
    {draft.length>0&&<section className="table-product-draft" aria-label="Onay bekleyen ürünler">
      <div className="table-product-draft-head"><strong>Onay bekleyenler</strong><span>{draftAmount} adet · henüz adisyona eklenmedi</span></div>
      <div className="table-product-draft-list">{draft.map(line=><div className="table-product-draft-row" key={line.id}>
        <div><strong>{line.amount} × {line.product.StokAdi}{line.portionName?` · ${line.portionName}`:''}</strong>{line.optionText&&<small>{line.optionText}</small>}{line.note&&<small>Not: {line.note}</small>}</div>
        <button type="button" className="secondary" disabled={confirm.isPending} aria-label={`${line.product.StokAdi} seçimini sil`} onClick={()=>{confirm.reset();setConfirmDiscard(false);setDraft(lines=>lines.filter(item=>item.id!==line.id));}}><Trash2 size={18}/> Sil</button>
      </div>)}</div>
    </section>}
    {confirmDiscard&&<div className="table-product-discard" role="alert"><span>{draftAmount} adet henüz kaydedilmedi. Seçimi silip adisyona dönmek istiyor musunuz?</span><button type="button" onClick={()=>setConfirmDiscard(false)}>Seçime devam et</button><button type="button" onClick={onClose}>Seçimi sil ve dön</button></div>}
    <div className="table-product-footer"><span role="status" aria-live="polite">{confirm.isPending?'Sipariş kaydediliyor…':draft.length>=50?'En fazla 50 ürün satırı seçilebilir.':draft.length?`${draftAmount} adet onay bekliyor`:lastAdded||`${added} adet eklendi · Ürün seçin, sonra onaylayın.`}</span><div className="table-product-footer-actions"><button type="button" className="secondary" disabled={confirm.isPending} onClick={closePicker}>{draft.length?'Seçimi bırak ve dön':'Adisyona dön'}</button><button type="button" className="primary" disabled={draft.length===0||confirm.isPending} onClick={()=>confirm.mutate(draft)}>Onayla ve ekle</button></div></div>
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
function PaymentModal({receipt,table,mealCards,onClose}:{receipt:Receipt;table:Table;mealCards:MealCard[];onClose:()=>void}){
  const client=useQueryClient();

  const oncekiNakit=receipt.NakitToplam??0;
  const oncekiBanka=receipt.BankaToplam??0;
  const oncekiCari=receipt.CariToplam??0;
  const oncekiYemek=receipt.YemekKartiToplam??0;
  const oncekiIndirim=receipt.IndirimToplam??0;
  const oncekiOdenen=oncekiNakit+oncekiBanka+oncekiCari+oncekiYemek+oncekiIndirim;
  const kalanTutar=Math.max(0,receipt.GenelToplam-oncekiOdenen);

  const [mode,setMode]=useState<'full'|'partial'|'equal'|'items'>('full');
  const isPartial=mode==='partial';
  const [mealCardId,setMealCardId]=useState('');
  const activeMealCards=mealCards.filter(card=>card.Aktif);
  const accounts=useQuery({queryKey:['accounts',''],queryFn:()=>api<Account[]>('/cari')});
  const activeAccounts=(accounts.data??[]).filter(item=>item.Aktif);
  const [accountId,setAccountId]=useState('');
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
  const needsMealCard=centsMealCard!==null&&centsMealCard>0&&activeMealCards.length>0&&!mealCardId;
  const needsAccount=centsAccount!==null&&centsAccount>0&&activeAccounts.length>0&&!accountId;
  const canSubmit=validTotal&&posApproved&&!needsMealCard&&!needsAccount;

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
      PosIslemId:posTx?.IslemId,
      YemekKartiKayitNo:centsMealCard&&mealCardId?Number(mealCardId):null,
      CariHesapKayitNo:centsAccount&&accountId?Number(accountId):null
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
          className={mode==='full'?'active':''}
          onClick={()=>{
            setMode('full');
            quickFill('cash');
          }}
        >
          Tam ödeme
        </button>
        <button
          type="button"
          className={isPartial?'active':''}
          onClick={()=>setMode('partial')}
        >
          Kısmi ödeme
        </button>
        <button type="button" className={mode==='equal'?'active':''} onClick={()=>setMode('equal')}>Eşit böl</button>
        <button type="button" className={mode==='items'?'active':''} onClick={()=>setMode('items')}>Ürün seçerek</button>
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

      {mode==='equal'||mode==='items'?(
        <SplitPaymentPanel key={mode} mode={mode} receipt={receipt} table={table} mealCards={mealCards} onClosed={onClose}/>
      ):<>
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
        {centsMealCard!==null&&centsMealCard>0&&activeMealCards.length>0&&(
          <label>
            Yemek kartı türü
            <select value={mealCardId} onChange={e=>setMealCardId(e.target.value)} disabled={payMutation.isPending}>
              <option value="">Kart seçin</option>
              {activeMealCards.map(card=><option key={card.KayitNo} value={card.KayitNo}>{card.Ad}</option>)}
            </select>
          </label>
        )}
        <label>
          Cari Hesap
          <input
            inputMode="decimal"
            value={account}
            onChange={e=>setAccount(e.target.value)}
            disabled={payMutation.isPending}
          />
        </label>
        {centsAccount!==null&&centsAccount>0&&activeAccounts.length>0&&(
          <label>
            Cari hesap
            <select value={accountId} onChange={e=>setAccountId(e.target.value)} disabled={payMutation.isPending}>
              <option value="">Hesap seçin</option>
              {activeAccounts.map(item=><option key={item.KayitNo} value={item.KayitNo}>{item.Unvan} · bakiye {money(item.Bakiye)}{item.KrediLimiti?` / limit ${money(item.KrediLimiti)}`:''}</option>)}
            </select>
          </label>
        )}
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
      {needsMealCard&&<p role="status" className="error-text">Yemek kartı ödemesi için kart türünü seçin.</p>}
      </>}
    </Modal>
  );
}
