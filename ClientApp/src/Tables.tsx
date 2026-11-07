import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Armchair,
  ArrowRight,
  Clock3,
  Plus,
  Minus,
  Trash2,
  ReceiptText,
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
import type {OrderLine, Product, Receipt, Section, Session, Table, PosCihazTipi, PosIslemKayit} from './types';
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
import {Empty, ErrorBox, Loading, Modal} from './ui';
import {MenuPage} from './MenuPage';
import './tables.css';

export function Tables({session}: {session: Session}) {
  const tables = useQuery({queryKey: ['tables'], queryFn: () => api<Table[]>('/masalar'), refetchInterval: 15000});
  const sections = useQuery({queryKey: ['sections'], queryFn: () => api<Section[]>('/bolumler'), refetchInterval: 15000});
  const [section, setSection] = useState<number | null>(null);
  const [status, setStatus] = useState<'all' | 'busy' | 'free' | 'reserved'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const table = tables.data?.find(t => t.MasaId === selected);
  const visible = (tables.data ?? []).filter(t =>
    (section === null || t.RestorantBolumuKayitNo === section) &&
    (status === 'all' || (status === 'busy' ? !!t.BaslikKayitNo : status === 'reserved' ? t.Rezerve : !t.BaslikKayitNo && !t.Rezerve)) &&
    t.MasaAdi.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Masalar</h1>
          <p>Restoran salonu ve servis masaları.</p>
        </div>
        <div className="date-label">
          {new Intl.DateTimeFormat('tr-TR', {weekday: 'long', day: 'numeric', month: 'long'}).format(new Date())}
        </div>
      </div>

      <div className={`floor-layout ${table ? 'has-selection' : ''}`}>
        <section className="floor-section">
          {/* Bölüm sekmeleri */}
          <div className="floor-toolbar">
            <div className="section-tabs" role="tablist" aria-label="Bölüm filtreleri">
              <button
                type="button"
                role="tab"
                aria-selected={section === null}
                className={`section-tab-btn ${section === null ? 'selected' : ''}`}
                onClick={() => setSection(null)}
              >
                <span>Tüm bölümler</span>
                <span className="tab-count">{tables.data?.length ?? '—'}</span>
              </button>
              {sections.data?.map(s => (
                <button
                  key={s.KayitNo}
                  type="button"
                  role="tab"
                  aria-selected={section === s.KayitNo}
                  className={`section-tab-btn ${section === s.KayitNo ? 'selected' : ''}`}
                  onClick={() => setSection(s.KayitNo)}
                >
                  <span>{s.BolumAdi}</span>
                  <span className="tab-count">{s.ToplamMasa}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Durum filtreleri & Arama */}
          <div className="floor-filter-row">
            <div className="status-pills" role="radiogroup" aria-label="Masa durumu filtreleri">
              {(
                [
                  ['all', 'Tümü', 'all'],
                  ['busy', 'Dolu', 'busy'],
                  ['free', 'Boş', 'free'],
                  ['reserved', 'Rezerve', 'reserved']
                ] as const
              ).map(([id, label, dotClass]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={status === id}
                  className={`status-pill-btn ${status === id ? 'current' : ''}`}
                  onClick={() => setStatus(id)}
                >
                  <span className={`pill-dot ${dotClass}`} aria-hidden="true"/>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="search-field">
              <Search size={15} className="search-icon" aria-hidden="true"/>
              <input
                type="search"
                placeholder="Masa ara…"
                aria-label="Masa ara"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ErrorBox
            error={tables.error || sections.error}
            retry={() => {
              void tables.refetch();
              void sections.refetch();
            }}
          />

          {tables.isPending ? (
            <Loading/>
          ) : visible.length === 0 ? (
            <Empty>Bu filtreye uygun masa bulunamadı.</Empty>
          ) : (
            <div className="table-grid">
              {visible.map(t => {
                const mins = minutes(t.AcilisTarihi);
                const isOccupied = !!t.BaslikKayitNo;
                const isReserved = t.Rezerve;
                const statusType = isOccupied ? 'occupied' : isReserved ? 'reserved' : 'free';
                const statusText = isOccupied ? 'Dolu' : isReserved ? 'Rezerve' : 'Boş';
                const isPicked = selected === t.MasaId;

                return (
                  <button
                    key={t.MasaId}
                    type="button"
                    className={`table-card ${statusType} ${isPicked ? 'picked' : ''}`}
                    onClick={() => setSelected(t.MasaId)}
                    aria-pressed={isPicked}
                  >
                    <div className="table-card-top">
                      <span className={`table-status-tag ${statusType}`}>
                        {statusText}
                      </span>
                      {isOccupied && (
                        <span className={`table-timer ${mins >= 60 ? 'late' : ''}`}>
                          <Clock3 size={11} aria-hidden="true"/>
                          <span>{mins} dk</span>
                        </span>
                      )}
                    </div>

                    <div className="table-card-center">
                      <h2 className="table-card-name">{t.MasaAdi}</h2>
                      <span className="table-card-section">{t.RestorantBolumAdi}</span>
                    </div>

                    <div className="table-card-bottom">
                      {isOccupied ? (
                        <>
                          <span className="table-timer">
                            {t.KisiSayisi > 0 ? `${t.KisiSayisi} kişi` : 'Açık'}
                          </span>
                          <strong className="table-bill-amount">{money(t.Tutar)}</strong>
                        </>
                      ) : (
                        <>
                          <span className="table-open-hint">
                            {isReserved ? 'Rezervasyon' : 'Adisyon aç'}
                          </span>
                          <span className="table-open-hint">
                            <Plus size={14}/>
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="floor-bottom-hint">
            <span className="hint-dot" aria-hidden="true"/>
            <span>Masa kartına dokunarak adisyon detayını açabilir veya sipariş alabilirsiniz.</span>
          </div>
        </section>

        {table && (
          <TableOrder
            key={table.MasaId}
            table={table}
            admin={session.Rol === 'Admin'}
            allTables={tables.data ?? []}
            close={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}

function minutes(date: string | null) {
  return date ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)) : 0;
}

function TableOrder({
  table,
  admin,
  allTables,
  close
}: {
  table: Table;
  admin: boolean;
  allTables: Table[];
  close: () => void;
}) {
  const client = useQueryClient();
  const [picker, setPicker] = useState(false);
  const [payment, setPayment] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [split, setSplit] = useState(false);
  const [merge, setMerge] = useState(false);
  const [cancel, setCancel] = useState<OrderLine | null>(null);
  const [note, setNote] = useState('');

  const receipt = useQuery({
    queryKey: ['receipt', table.MasaId],
    queryFn: () => api<Receipt | null>(`/masalar/${table.MasaId}/adisyon`),
    refetchInterval: 15000
  });

  const mutation = useMutation({
    mutationFn: ({path, method, body}: {path: string; method: string; body?: unknown}) =>
      api(path, {method, body: body ? JSON.stringify(body) : undefined}),
    onSuccess: () => client.invalidateQueries()
  });

  const transferMutation = useMutation({
    mutationFn: (hedefMasaKayitNo: number) =>
      masaTasi({KaynakMasaKayitNo: table.MasaId, HedefMasaKayitNo: hedefMasaKayitNo}),
    onSuccess: async () => {
      await client.invalidateQueries();
      setTransfer(false);
      close();
    }
  });

  const busy = mutation.isPending || transferMutation.isPending;
  const order = receipt.data;

  const add = (p: Product) => {
    mutation.mutate(
      {path: '/siparisler', method: 'POST', body: {MasaKayitNo: table.MasaId, StokKayitNo: p.KayitNo, Miktar: 1, SatirAciklama: note}},
      {
        onSuccess: () => {
          setPicker(false);
          setNote('');
        }
      }
    );
  };

  const change = (line: OrderLine, delta: number) => {
    if (line.Miktar + delta <= 0) {
      setCancel(line);
      return;
    }
    mutation.mutate({
      path: `/siparisler/${line.KayitNo}`,
      method: 'PATCH',
      body: {DetayKayitNo: line.KayitNo, Miktar: line.Miktar + delta, SatirAciklama: line.SatirAciklama, Ikram: line.Ikram}
    });
  };

  return (
    <aside className="order-panel" aria-label={`${table.MasaAdi} adisyonu`}>
      <div className="order-panel-header">
        <div className="order-title-group">
          <h2>{table.MasaAdi}</h2>
          <span className="order-section-badge">{table.RestorantBolumAdi}</span>
        </div>
        <button
          type="button"
          className="workspace-icon-btn"
          onClick={close}
          aria-label="Adisyon panelini kapat"
          title="Kapat"
        >
          <X size={16}/>
        </button>
      </div>

      <div className="order-meta-strip">
        <div className="order-meta-item">
          <ReceiptText size={13} aria-hidden="true"/>
          <span>{order ? `Adisyon #${order.KayitNo}` : 'Açık Masa'}</span>
        </div>
        <div className="order-meta-item">
          <Clock3 size={13} aria-hidden="true"/>
          <span>{minutes(table.AcilisTarihi)} dk açık</span>
        </div>
      </div>

      <ErrorBox error={receipt.error || mutation.error} retry={() => void receipt.refetch()}/>

      <div className="order-lines-viewport">
        {receipt.isPending ? (
          <Loading/>
        ) : !order || order.Detaylar.length === 0 ? (
          <div className="order-empty-message">
            <ReceiptText size={32} strokeWidth={1.4}/>
            <p>Bu masada henüz sipariş kalemi yok.<br/>Menüden ürün seçerek ekleyebilirsiniz.</p>
          </div>
        ) : (
          order.Detaylar.map(line => (
            <div className="order-line-item" key={line.KayitNo}>
              <div className="line-item-top">
                <div className="line-item-title">
                  <span className="line-item-qty-tag">{line.Miktar}×</span>
                  <span className="line-item-name" title={line.StokAdi}>{line.StokAdi}</span>
                </div>
                <strong className="line-item-total">{money(line.SatirTutari)}</strong>
              </div>

              {line.SatirAciklama && (
                <div className="line-item-note">
                  <span>Not: {line.SatirAciklama}</span>
                </div>
              )}

              <div className="line-item-bottom">
                <span className="line-unit-price">{money(line.BirimFiyat)} / adet</span>

                <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                  <div className="line-stepper">
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={busy}
                      aria-label={`${line.StokAdi} adet azalt`}
                      onClick={() => change(line, -1)}
                    >
                      <Minus size={12}/>
                    </button>
                    <span className="stepper-count">{line.Miktar}</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={busy}
                      aria-label={`${line.StokAdi} adet artır`}
                      onClick={() => change(line, 1)}
                    >
                      <Plus size={12}/>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    className="line-delete-btn"
                    aria-label={`${line.StokAdi} satırını kaldır`}
                    onClick={() => setCancel(line)}
                    title="Satırı Kaldır"
                  >
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="order-panel-footer">
        <button
          type="button"
          className="add-product-btn"
          disabled={busy || receipt.isPending || !!receipt.error}
          onClick={() => {
            mutation.reset();
            setPicker(true);
          }}
        >
          <Plus size={16}/>
          <span>Menüden Ürün Ekle</span>
        </button>

        {order && (
          <div className="bill-summary">
            <div className="bill-row">
              <span>Ara Toplam</span>
              <span>{money(order.GenelToplam / 1.1)}</span>
            </div>
            <div className="bill-row">
              <span>KDV (%10 Dahil)</span>
              <span>{money(order.GenelToplam - order.GenelToplam / 1.1)}</span>
            </div>
            <div className="bill-row grand-total">
              <span>Ödenecek Tutar</span>
              <strong>{money(order.GenelToplam)}</strong>
            </div>
          </div>
        )}

        {admin ? (
          <div className="order-actions-stack">
            <button
              type="button"
              className="pay-primary-btn"
              disabled={!order || order.Detaylar.length === 0 || busy}
              onClick={() => setPayment(true)}
            >
              <CreditCard size={17}/>
              <span>Hesabı Kapat / Ödeme Al</span>
              <ArrowRight size={15}/>
            </button>

            <div className="table-ops-row">
              <button
                type="button"
                className="op-btn"
                disabled={!order || busy}
                onClick={() => setTransfer(true)}
                title="Adisyonu başka boş masaya taşı"
              >
                <MoveRight size={13}/>
                <span>Taşı</span>
              </button>
              <button
                type="button"
                className="op-btn"
                disabled={!order || order.Detaylar.length <= 1 || busy}
                onClick={() => setSplit(true)}
                title="Siparişleri bölerek yeni masaya aktar"
              >
                <Split size={13}/>
                <span>Ayır</span>
              </button>
              <button
                type="button"
                className="op-btn"
                disabled={!order || busy}
                onClick={() => setMerge(true)}
                title="Diğer açık masaları bu masaya topla"
              >
                <GitMerge size={13}/>
                <span>Birleştir</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="modal-desc" style={{textAlign: 'center', fontSize: '0.78rem'}}>
            Ödeme alma ve masa transfer yetkisi yönetici rolüne aittir.
          </p>
        )}
      </div>

      {picker && (
        <Modal
          title={`${table.MasaAdi} · Ürün Ekle`}
          onClose={() => {
            if (!busy) setPicker(false);
          }}
        >
          <div className="modal-body-stack">
            <div className="modal-field">
              <label htmlFor="order-note-input">Sipariş Notu</label>
              <input
                id="order-note-input"
                maxLength={250}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Örn: Az pişmiş, soğansız…"
              />
            </div>
            <ErrorBox error={mutation.error}/>
            <MenuPage onAdd={add} busy={busy}/>
            {busy && <p role="status">Sipariş ekleniyor…</p>}
          </div>
        </Modal>
      )}

      {cancel && (
        <Modal
          title="Ürünü Adisyondan Kaldır"
          onClose={() => {
            if (!busy) setCancel(null);
          }}
        >
          <div className="modal-body-stack">
            <p className="modal-desc">
              <strong>{cancel.StokAdi}</strong> ({cancel.Miktar} adet) siparişten tamamen kaldırılacak. Emin misiniz?
            </p>
            <ErrorBox error={mutation.error}/>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                disabled={busy}
                onClick={() => setCancel(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="modal-btn danger"
                disabled={busy}
                onClick={() =>
                  mutation.mutate(
                    {path: `/siparisler/${cancel.KayitNo}`, method: 'DELETE'},
                    {onSuccess: () => setCancel(null)}
                  )
                }
              >
                Ürünü Kaldır
              </button>
            </div>
          </div>
        </Modal>
      )}

      {payment && order && (
        <PaymentModal receipt={order} table={table} onClose={() => setPayment(false)}/>
      )}

      {transfer && (
        <Modal
          title={`${table.MasaAdi} · Masayı Taşı`}
          onClose={() => {
            if (!busy) setTransfer(false);
          }}
        >
          <div className="modal-body-stack">
            <p className="modal-desc">Adisyonun aktarılacağı hedef boş masayı seçin.</p>
            <ErrorBox error={transferMutation.error || mutation.error}/>
            <div className="transfer-list">
              {allTables
                .filter(t => t.MasaId !== table.MasaId && !t.BaslikKayitNo && !t.BirlesmisMasa && !t.Rezerve)
                .map(t => (
                  <button
                    key={t.MasaId}
                    type="button"
                    className="transfer-item-btn"
                    disabled={busy}
                    onClick={() => transferMutation.mutate(t.MasaId)}
                  >
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}}>
                      <Armchair size={16}/>
                      <span>{t.MasaAdi}</span>
                    </span>
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--ink-soft)'}}>
                      <span>{t.RestorantBolumAdi}</span>
                      <ArrowRight size={14}/>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {split && order && (
        <SplitModal receipt={order} table={table} allTables={allTables} onClose={() => setSplit(false)}/>
      )}

      {merge && order && (
        <MergeModal receipt={order} table={table} allTables={allTables} onClose={() => setMerge(false)}/>
      )}
    </aside>
  );
}

// ───── MASA AYIRMA MODALI ─────
function SplitModal({
  receipt,
  table,
  allTables,
  onClose
}: {
  receipt: Receipt;
  table: Table;
  allTables: Table[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const emptyTables = allTables.filter(t => t.MasaId !== table.MasaId && !t.BaslikKayitNo && !t.BirlesmisMasa && !t.Rezerve);
  const [targetId, setTargetId] = useState<number | null>(emptyTables[0]?.MasaId ?? null);
  const [splitQty, setSplitQty] = useState<Record<number, number>>({});

  const toggleLine = (lineKayitNo: number) => {
    setSplitQty(prev => {
      const next = {...prev};
      if ((next[lineKayitNo] ?? 0) > 0) {
        delete next[lineKayitNo];
      } else {
        next[lineKayitNo] = 1;
      }
      return next;
    });
  };

  const adjustQty = (lineKayitNo: number, delta: number, maxQty: number) => {
    setSplitQty(prev => {
      const current = prev[lineKayitNo] ?? 0;
      const updated = Math.max(1, Math.min(maxQty, current + delta));
      return {...prev, [lineKayitNo]: updated};
    });
  };

  const ayrilanSatirlar = Object.entries(splitQty)
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => ({DetayKayitNo: Number(id), Miktar: qty}));

  let ayrilanTutar = 0;
  for (const item of ayrilanSatirlar) {
    const line = receipt.Detaylar.find(d => d.KayitNo === item.DetayKayitNo);
    if (line && !line.Ikram) {
      ayrilanTutar += line.BirimFiyat * item.Miktar;
    }
  }

  const kalanTutar = Math.max(0, receipt.GenelToplam - ayrilanTutar);
  const hepsiSecildi = receipt.Detaylar.length > 0 && receipt.Detaylar.every(d => (splitQty[d.KayitNo] ?? 0) === d.Miktar);
  const splitGecerli = targetId !== null && ayrilanSatirlar.length > 0 && !hepsiSecildi;

  const splitMutation = useMutation({
    mutationFn: () =>
      masaAyir({
        MasaKayitNo: table.MasaId,
        HedefMasaKayitNo: targetId!,
        AyrilanSatirlar: ayrilanSatirlar
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal
      title={`${table.MasaAdi} · Masayı Ayır`}
      onClose={() => {
        if (!splitMutation.isPending) onClose();
      }}
    >
      <div className="modal-body-stack">
        <p className="modal-desc">Yeni masaya aktarılacak siparişleri ve hedef masayı belirleyin.</p>
        <ErrorBox error={splitMutation.error}/>

        {emptyTables.length === 0 ? (
          <div className="payment-summary-strip" style={{borderColor: 'var(--danger)', color: 'var(--danger)'}}>
            <AlertCircle size={18}/>
            <span>Ayrılabilecek boş masa bulunamadı. Lütfen önce bir masa boşaltın.</span>
          </div>
        ) : (
          <>
            <div className="modal-field">
              <label htmlFor="split-target-select">Hedef Boş Masa</label>
              <select
                id="split-target-select"
                value={targetId ?? ''}
                onChange={e => setTargetId(Number(e.target.value))}
                disabled={splitMutation.isPending}
              >
                {emptyTables.map(t => (
                  <option key={t.MasaId} value={t.MasaId}>
                    {t.MasaAdi} ({t.RestorantBolumAdi})
                  </option>
                ))}
              </select>
            </div>

            <div className="split-item-list">
              {receipt.Detaylar.map(line => {
                const isSelected = (splitQty[line.KayitNo] ?? 0) > 0;
                const currentQty = splitQty[line.KayitNo] ?? 1;
                return (
                  <div key={line.KayitNo} className={`split-item-row ${isSelected ? 'selected' : ''}`}>
                    <div className="split-item-info">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLine(line.KayitNo)}
                        id={`split-check-${line.KayitNo}`}
                      />
                      <label htmlFor={`split-check-${line.KayitNo}`} className="split-item-title">
                        <strong>{line.StokAdi}</strong>
                        <small>{line.Miktar} adet mevcut · {money(line.BirimFiyat)}</small>
                      </label>
                    </div>
                    {isSelected && (
                      <div className="split-qty-controls">
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={currentQty <= 1 || splitMutation.isPending}
                          onClick={() => adjustQty(line.KayitNo, -1, line.Miktar)}
                        >
                          <Minus size={12}/>
                        </button>
                        <span className="stepper-count">{currentQty}</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={currentQty >= line.Miktar || splitMutation.isPending}
                          onClick={() => adjustQty(line.KayitNo, 1, line.Miktar)}
                        >
                          <Plus size={12}/>
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

            {hepsiSecildi && (
              <p className="modal-desc" style={{color: 'var(--danger)', fontWeight: 500}}>
                Tüm siparişler ayrılamaz; masanın tamamını aktarmak için &quot;Masayı Taşı&quot; işlemini kullanın.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                disabled={splitMutation.isPending}
                onClick={onClose}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="modal-btn primary"
                disabled={!splitGecerli || splitMutation.isPending}
                onClick={() => splitMutation.mutate()}
              >
                {splitMutation.isPending ? 'Ayrılıyor…' : 'Masayı Ayır'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ───── MASA BİRLEŞTİRME MODALI ─────
function MergeModal({
  receipt,
  table,
  allTables,
  onClose
}: {
  receipt: Receipt;
  table: Table;
  allTables: Table[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const otherOccupied = allTables.filter(t => t.MasaId !== table.MasaId && !!t.BaslikKayitNo && !t.BirlesmisMasa);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleTable = (id: number) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const selectedTables = otherOccupied.filter(t => selectedIds.includes(t.MasaId));
  const mergedTotal = selectedTables.reduce((sum, t) => sum + (t.Tutar ?? 0), 0);
  const combinedTotal = receipt.GenelToplam + mergedTotal;

  const mergeMutation = useMutation({
    mutationFn: () =>
      masaBirlestir({
        AnaMasaKayitNo: table.MasaId,
        BirlestirilecekMasaKayitNolar: selectedIds
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal
      title={`${table.MasaAdi} · Masaları Birleştir`}
      onClose={() => {
        if (!mergeMutation.isPending) onClose();
      }}
    >
      <div className="modal-body-stack">
        <p className="modal-desc">
          <strong>{table.MasaAdi}</strong> ana masa olacak şekilde diğer açık masaların siparişlerini buraya toplayın.
        </p>
        <ErrorBox error={mergeMutation.error}/>

        {otherOccupied.length === 0 ? (
          <Empty>Birleştirilebilecek açık başka masa yok.</Empty>
        ) : (
          <>
            <div className="merge-item-list">
              {otherOccupied.map(t => {
                const isSelected = selectedIds.includes(t.MasaId);
                return (
                  <div
                    key={t.MasaId}
                    className={`merge-item-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTable(t.MasaId)}
                    style={{cursor: 'pointer'}}
                  >
                    <div className="merge-item-left">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTable(t.MasaId)}
                        onClick={e => e.stopPropagation()}
                        id={`merge-check-${t.MasaId}`}
                      />
                      <label htmlFor={`merge-check-${t.MasaId}`} className="merge-item-meta" style={{cursor: 'pointer'}}>
                        <strong>{t.MasaAdi}</strong>
                        <small>{t.RestorantBolumAdi} · {t.KisiSayisi} kişi</small>
                      </label>
                    </div>
                    <strong className="merge-item-total">{money(t.Tutar)}</strong>
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

            <p className="modal-desc" style={{fontSize: '0.78rem'}}>
              Birleşen masaların tüm siparişleri ve ödemeleri {table.MasaAdi} adisyonuna aktarılır, diğer masalar kapatılır.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                disabled={mergeMutation.isPending}
                onClick={onClose}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="modal-btn primary"
                disabled={selectedIds.length === 0 || mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
              >
                {mergeMutation.isPending ? 'Birleştiriliyor…' : `Masaları Birleştir (${money(combinedTotal)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ───── KISMİ ÖDEME & POS CİHAZ ENTEGRASYONU MODALI ─────
function PaymentModal({
  receipt,
  table,
  onClose
}: {
  receipt: Receipt;
  table: Table;
  onClose: () => void;
}) {
  const client = useQueryClient();

  const oncekiNakit = receipt.NakitToplam ?? 0;
  const oncekiBanka = receipt.BankaToplam ?? 0;
  const oncekiCari = receipt.CariToplam ?? 0;
  const oncekiYemek = receipt.YemekKartiToplam ?? 0;
  const oncekiIndirim = receipt.IndirimToplam ?? 0;
  const oncekiOdenen = oncekiNakit + oncekiBanka + oncekiCari + oncekiYemek + oncekiIndirim;
  const kalanTutar = Math.max(0, receipt.GenelToplam - oncekiOdenen);

  const [isPartial, setIsPartial] = useState(false);
  const [cash, setCash] = useState(kalanTutar.toFixed(2));
  const [card, setCard] = useState('0');
  const [account, setAccount] = useState('0');
  const [mealCard, setMealCard] = useState('0');
  const [discount, setDiscount] = useState('0');

  // POS State Machine
  const [posDevice, setPosDevice] = useState<PosCihazTipi>(0); // 0=Manuel, 1=Hugin S1, 2=PayGo
  const [posTx, setPosTx] = useState<PosIslemKayit | null>(null);
  const [posBusy, setPosBusy] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);

  const centsCash = toCents(cash);
  const centsCard = toCents(card);
  const centsAccount = toCents(account);
  const centsMealCard = toCents(mealCard);
  const centsDiscount = toCents(discount);

  const allParsed =
    centsCash !== null &&
    centsCard !== null &&
    centsAccount !== null &&
    centsMealCard !== null &&
    centsDiscount !== null;

  const centsSum = allParsed
    ? centsCash + centsCard + centsAccount + centsMealCard + centsDiscount
    : 0;
  const centsKalan = Math.round(kalanTutar * 100);

  // Validation
  const validTotal =
    allParsed &&
    (isPartial ? centsSum > 0 && centsSum <= centsKalan : centsSum === centsKalan);

  const needsIntegratedPos = centsCard !== null && centsCard > 0 && (posDevice === 1 || posDevice === 2);
  const posApproved = needsIntegratedPos ? posTx?.Basarili === true : true;
  const canSubmit = validTotal && posApproved;

  const quickFill = (type: 'cash' | 'card' | 'mealCard') => {
    const remaining = kalanTutar.toFixed(2);
    setCash(type === 'cash' ? remaining : '0');
    setCard(type === 'card' ? remaining : '0');
    setAccount('0');
    setMealCard(type === 'mealCard' ? remaining : '0');
    setDiscount('0');
    setPosTx(null);
  };

  const handleStartPos = async () => {
    if (centsCard === null || centsCard <= 0) return;
    setPosBusy(true);
    setPosError(null);
    try {
      const tx = await posIslemBaslat({
        BaslikKayitNo: receipt.KayitNo,
        MasaKayitNo: table.MasaId,
        Tutar: centsCard / 100,
        CihazTipi: posDevice
      });
      setPosTx(tx);
    } catch (err: any) {
      setPosError(err.message || 'POS işlemi başlatılamadı.');
    } finally {
      setPosBusy(false);
    }
  };

  const handleCheckPos = async () => {
    if (!posTx) return;
    setPosBusy(true);
    try {
      const updated = await posIslemSorgula(posTx.IslemId);
      setPosTx(updated);
    } catch (err: any) {
      setPosError(err.message || 'POS durumu sorgulanamadı.');
    } finally {
      setPosBusy(false);
    }
  };

  const handleSimulateApprove = async () => {
    if (!posTx) return;
    setPosBusy(true);
    try {
      const approved = await posIslemSimuleSonuc(posTx.IslemId, true);
      setPosTx(approved);
    } catch (err: any) {
      setPosError(err.message || 'Simülasyon başarısız.');
    } finally {
      setPosBusy(false);
    }
  };

  const payMutation = useMutation({
    mutationFn: () =>
      masaOdeme(table.MasaId, {
        BaslikKayitNo: receipt.KayitNo,
        NakitTutar: centsCash! / 100,
        BankaTutar: centsCard! / 100,
        CariTutar: centsAccount! / 100,
        YemekKartiTutar: centsMealCard! / 100,
        IndirimTutar: centsDiscount! / 100,
        KismiOdeme: isPartial,
        PosIslemId: posTx?.IslemId
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
      onClose();
    }
  });

  return (
    <Modal
      title={`${table.MasaAdi} · Ödeme Al`}
      onClose={() => {
        if (!payMutation.isPending) onClose();
      }}
    >
      <div className="modal-body-stack">
        <div className="payment-type-tabs">
          <button
            type="button"
            className={`payment-type-tab-btn ${!isPartial ? 'active' : ''}`}
            onClick={() => {
              setIsPartial(false);
              quickFill('cash');
            }}
          >
            Tam Ödeme (Hesabı Kapat)
          </button>
          <button
            type="button"
            className={`payment-type-tab-btn ${isPartial ? 'active' : ''}`}
            onClick={() => setIsPartial(true)}
          >
            Kısmi Ödeme (Hesap Açık Kalsın)
          </button>
        </div>

        <div className="payment-summary-strip">
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
            <span style={{fontSize: '0.78rem', color: 'var(--ink-soft)'}}>Adisyon Toplamı</span>
            <strong style={{fontSize: '1rem', fontVariantNumeric: 'tabular-nums'}}>{money(receipt.GenelToplam)}</strong>
          </div>
          {oncekiOdenen > 0 && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'center'}}>
              <span style={{fontSize: '0.78rem', color: 'var(--ink-soft)'}}>Ödenen</span>
              <strong style={{fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums'}}>{money(oncekiOdenen)}</strong>
            </div>
          )}
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'right'}}>
            <span style={{fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600}}>Kalan Tutar</span>
            <strong style={{fontSize: '1.15rem', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums'}}>
              {money(kalanTutar)}
            </strong>
          </div>
        </div>

        <div className="payment-shortcuts">
          <button type="button" className="payment-shortcut-btn" onClick={() => quickFill('cash')}>
            <Banknote size={14}/>
            <span>Tamamı Nakit</span>
          </button>
          <button type="button" className="payment-shortcut-btn" onClick={() => quickFill('card')}>
            <CreditCard size={14}/>
            <span>Tamamı Kart</span>
          </button>
          <button type="button" className="payment-shortcut-btn" onClick={() => quickFill('mealCard')}>
            <span>Tamamı Yemek Kartı</span>
          </button>
        </div>

        <div className="payment-methods-grid">
          <div className="payment-method-card">
            <label htmlFor="pay-cash-input">Nakit Tutarı (₺)</label>
            <input
              id="pay-cash-input"
              inputMode="decimal"
              value={cash}
              onChange={e => setCash(e.target.value)}
              disabled={payMutation.isPending}
            />
          </div>

          <div className="payment-method-card">
            <label htmlFor="pay-card-input">Banka / Kredi Kartı (₺)</label>
            <input
              id="pay-card-input"
              inputMode="decimal"
              value={card}
              onChange={e => {
                setCard(e.target.value);
                setPosTx(null);
              }}
              disabled={payMutation.isPending}
            />
          </div>

          <div className="payment-method-card">
            <label htmlFor="pay-meal-input">Yemek Kartı (Sodexo / Multinet)</label>
            <input
              id="pay-meal-input"
              inputMode="decimal"
              value={mealCard}
              onChange={e => setMealCard(e.target.value)}
              disabled={payMutation.isPending}
            />
          </div>

          <div className="payment-method-card">
            <label htmlFor="pay-account-input">Cari Hesap (₺)</label>
            <input
              id="pay-account-input"
              inputMode="decimal"
              value={account}
              onChange={e => setAccount(e.target.value)}
              disabled={payMutation.isPending}
            />
          </div>

          <div className="payment-method-card" style={{gridColumn: '1 / -1'}}>
            <label htmlFor="pay-discount-input">İndirim Tutarı (₺)</label>
            <input
              id="pay-discount-input"
              inputMode="decimal"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              disabled={payMutation.isPending}
            />
          </div>
        </div>

        {/* POS Cihaz Entegrasyonu */}
        {centsCard !== null && centsCard > 0 && (
          <div className="pos-section">
            <div className="pos-section-header">
              <h4>
                <CreditCard size={15}/>
                <span>POS Terminal Entegrasyonu</span>
              </h4>
              <span style={{fontSize: '0.8rem', color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums'}}>
                {money(centsCard / 100)} için
              </span>
            </div>

            <div className="pos-device-chips">
              <button
                type="button"
                className={`pos-device-chip ${posDevice === 0 ? 'active' : ''}`}
                onClick={() => {
                  setPosDevice(0);
                  setPosTx(null);
                }}
              >
                Harici / Manuel POS
              </button>
              <button
                type="button"
                className={`pos-device-chip ${posDevice === 1 ? 'active' : ''}`}
                onClick={() => {
                  setPosDevice(1);
                  setPosTx(null);
                }}
              >
                Hugin S1 POS
              </button>
              <button
                type="button"
                className={`pos-device-chip ${posDevice === 2 ? 'active' : ''}`}
                onClick={() => {
                  setPosDevice(2);
                  setPosTx(null);
                }}
              >
                PayGo POS
              </button>
            </div>

            {posDevice !== 0 && (
              <div className="pos-terminal-state">
                {posError && <p className="modal-desc" style={{color: 'var(--danger)'}}>{posError}</p>}

                {!posTx ? (
                  <button
                    type="button"
                    className="modal-btn primary"
                    disabled={posBusy}
                    onClick={handleStartPos}
                  >
                    <CreditCard size={15}/>
                    <span>{posDevice === 1 ? 'Hugin S1' : 'PayGo'} Terminaline Gönder ({money(centsCard / 100)})</span>
                  </button>
                ) : (
                  <>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span className={`pos-status-badge ${posTx.Basarili ? 'approved' : posTx.Durum === 3 ? 'rejected' : 'waiting'}`}>
                        {posTx.Basarili ? (
                          <CheckCircle2 size={13}/>
                        ) : posTx.Durum === 3 ? (
                          <AlertCircle size={13}/>
                        ) : (
                          <RefreshCw size={13} className="spin"/>
                        )}
                        <span>
                          {posTx.Basarili
                            ? 'Onaylandı'
                            : posTx.Durum === 1
                            ? 'Cihaza Gönderildi'
                            : posTx.Durum === 3
                            ? 'Reddedildi'
                            : 'Beklemede'}
                        </span>
                      </span>
                      <small style={{fontSize: '0.74rem', color: 'var(--ink-soft)'}}>ID: {posTx.IslemId.substring(0, 8)}</small>
                    </div>

                    <div className="pos-terminal-details">
                      {posTx.Basarili ? (
                        <>
                          <span>Kart: <code>{posTx.MaskedPan}</code></span>
                          <span>Onay Kodu: <code>{posTx.AuthCode}</code> · RRN: <code>{posTx.Rrn}</code></span>
                        </>
                      ) : (
                        <span>Terminalden kart çekilmesi veya temassız okutulması bekleniyor…</span>
                      )}
                    </div>

                    <div className="pos-actions-bar">
                      {!posTx.Basarili && (
                        <>
                          <button
                            type="button"
                            className="modal-btn secondary"
                            disabled={posBusy}
                            onClick={handleCheckPos}
                          >
                            <RefreshCw size={13}/>
                            <span>Durum Sorgula</span>
                          </button>
                          <button
                            type="button"
                            className="modal-btn secondary"
                            disabled={posBusy}
                            onClick={handleSimulateApprove}
                          >
                            <CheckCircle2 size={13}/>
                            <span>Terminal Onay Simülasyonu</span>
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

        {!validTotal && (
          <p role="status" className="modal-desc" style={{color: 'var(--danger)', fontWeight: 500}}>
            {isPartial
              ? "Kısmi ödeme tutarı 0'dan büyük ve kalan tutardan küçük veya eşit olmalıdır."
              : `Girilen ödemeler toplamı (${money(centsSum / 100)}) kalan tutarla (${money(kalanTutar)}) tam eşleşmelidir.`}
          </p>
        )}

        {needsIntegratedPos && !posTx?.Basarili && (
          <p role="status" className="modal-desc" style={{color: 'var(--danger)', fontWeight: 500}}>
            Entegre POS seçildiğinde ödemeyi tamamlamadan önce POS terminal onayının alınması zorunludur.
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn secondary"
            disabled={payMutation.isPending}
            onClick={onClose}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="modal-btn primary"
            disabled={!canSubmit || payMutation.isPending}
            onClick={() => payMutation.mutate()}
          >
            {payMutation.isPending ? 'Kaydediliyor…' : isPartial ? 'Kısmi Ödemeyi Kaydet' : 'Ödemeyi Tamamla'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
