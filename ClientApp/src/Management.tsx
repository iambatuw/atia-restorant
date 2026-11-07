import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  CalendarDays,
  Plus,
  Trash2,
  TrendingUp,
  Receipt,
  Clock,
  Users
} from 'lucide-react';
import {api, localDate, money} from './api';
import type {Report, Reservation, Table} from './types';
import {Empty, ErrorBox, Loading, Modal} from './ui';
import './management.css';

export default function Management({page}: {page: 'raporlar' | 'rezervasyonlar'}) {
  return page === 'raporlar' ? <Reports/> : <Reservations/>;
}

function Reports() {
  const [date, setDate] = useState(localDate());
  const report = useQuery({
    queryKey: ['report', date],
    queryFn: () => api<Report>(`/raporlar/gunluk?tarih=${date}`),
    refetchInterval: 15000
  });

  const r = report.data;
  const avgOrder = r && r.ToplamAdisyon > 0 ? r.ToplamCiro / r.ToplamAdisyon : 0;
  const totalPaid = r ? r.NakitToplam + r.BankaToplam + r.CariToplam + r.YemekKartiToplam : 0;
  const getShare = (val: number) => (totalPaid > 0 ? Math.round((val / totalPaid) * 100) : 0);

  return (
    <section className="mgmt-section" aria-label="Günlük satış ve operasyon raporu">
      <div className="page-heading">
        <div>
          <h1>Günlük Rapor</h1>
          <p>Kapanan adisyonlar, tahsilat dağılımı ve saatlik ciro istatistikleri.</p>
        </div>
        <div className="report-date-control">
          <label className="date-picker-label">
            <span>Rapor tarihi:</span>
            <input
              type="date"
              required
              aria-label="Rapor tarihi"
              value={date}
              max={localDate()}
              onChange={e => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        </div>
      </div>

      <ErrorBox error={report.error} retry={() => void report.refetch()}/>

      {report.isPending ? (
        <Loading/>
      ) : r ? (
        <>
          <div className="kpi-grid">
            <div className="kpi-card highlight">
              <div className="kpi-header">
                <span className="kpi-title">Toplam Tahsilat (Ciro)</span>
                <span className="kpi-badge primary">Kapanan</span>
              </div>
              <strong className="kpi-value">{money(r.ToplamCiro)}</strong>
              <div className="kpi-footer">
                <span>{date} tarihli kesinleşen net ciro</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Kapanan Adisyon</span>
                <Receipt size={16} className="kpi-icon" aria-hidden="true"/>
              </div>
              <strong className="kpi-value">{r.ToplamAdisyon}</strong>
              <div className="kpi-footer">
                <span>Tamamlanan masa adisyonu</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Ortalama Masa Tutarı</span>
                <TrendingUp size={16} className="kpi-icon" aria-hidden="true"/>
              </div>
              <strong className="kpi-value">{money(avgOrder)}</strong>
              <div className="kpi-footer">
                <span>Adisyon başına ortalama tutar</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Açık Adisyon Sayısı</span>
                <span className="kpi-badge warning">{r.AcikAdisyon} masa</span>
              </div>
              <strong className="kpi-value">{r.AcikAdisyon}</strong>
              <div className="kpi-footer">
                <span>Salonda henüz tahsil edilmedi</span>
              </div>
            </div>
          </div>

          <div className="mgmt-dual-grid">
            <section className="mgmt-panel" aria-label="Tahsilat yöntemleri dağılımı">
              <div className="panel-title-bar">
                <h2>Tahsilat Yöntemleri Dağılımı</h2>
                <span className="panel-meta">Toplam: {money(totalPaid)}</span>
              </div>

              <div className="payment-progress-bar" title="Tahsilat Dağılımı">
                {r.NakitToplam > 0 && (
                  <div
                    className="progress-seg cash"
                    style={{width: `${getShare(r.NakitToplam)}%`}}
                    title={`Nakit: %${getShare(r.NakitToplam)}`}
                  />
                )}
                {r.BankaToplam > 0 && (
                  <div
                    className="progress-seg card"
                    style={{width: `${getShare(r.BankaToplam)}%`}}
                    title={`Banka / Kart: %${getShare(r.BankaToplam)}`}
                  />
                )}
                {r.YemekKartiToplam > 0 && (
                  <div
                    className="progress-seg meal"
                    style={{width: `${getShare(r.YemekKartiToplam)}%`}}
                    title={`Yemek Kartı: %${getShare(r.YemekKartiToplam)}`}
                  />
                )}
                {r.CariToplam > 0 && (
                  <div
                    className="progress-seg account"
                    style={{width: `${getShare(r.CariToplam)}%`}}
                    title={`Cari: %${getShare(r.CariToplam)}`}
                  />
                )}
              </div>

              <div className="payment-ledger">
                <div className="ledger-row">
                  <div className="ledger-method">
                    <span className="ledger-dot cash" aria-hidden="true"/>
                    <strong>Nakit Tahsilat</strong>
                  </div>
                  <span className="ledger-share">%{getShare(r.NakitToplam)}</span>
                  <strong className="ledger-val">{money(r.NakitToplam)}</strong>
                </div>

                <div className="ledger-row">
                  <div className="ledger-method">
                    <span className="ledger-dot card" aria-hidden="true"/>
                    <strong>Banka / Kredi Kartı</strong>
                  </div>
                  <span className="ledger-share">%{getShare(r.BankaToplam)}</span>
                  <strong className="ledger-val">{money(r.BankaToplam)}</strong>
                </div>

                <div className="ledger-row">
                  <div className="ledger-method">
                    <span className="ledger-dot meal" aria-hidden="true"/>
                    <strong>Yemek Kartı (Sodexo / Multi)</strong>
                  </div>
                  <span className="ledger-share">%{getShare(r.YemekKartiToplam)}</span>
                  <strong className="ledger-val">{money(r.YemekKartiToplam)}</strong>
                </div>

                <div className="ledger-row">
                  <div className="ledger-method">
                    <span className="ledger-dot account" aria-hidden="true"/>
                    <strong>Cari / Açık Hesap</strong>
                  </div>
                  <span className="ledger-share">%{getShare(r.CariToplam)}</span>
                  <strong className="ledger-val">{money(r.CariToplam)}</strong>
                </div>

                {r.IndirimToplam > 0 && (
                  <div className="ledger-row discount">
                    <div className="ledger-method">
                      <span className="ledger-dot discount" aria-hidden="true"/>
                      <span>Uygulanan İkram / İndirim</span>
                    </div>
                    <span className="ledger-share">—</span>
                    <strong className="ledger-val">-{money(r.IndirimToplam)}</strong>
                  </div>
                )}
              </div>
            </section>

            <section className="mgmt-panel" aria-label="En çok satan ürünler">
              <div className="panel-title-bar">
                <h2>En Çok Satan Ürünler</h2>
                <span className="panel-meta">{r.EnCokSatan.length} Kalem</span>
              </div>

              {r.EnCokSatan.length > 0 ? (
                <div className="top-sellers-table-wrapper">
                  <table className="craft-table">
                    <thead>
                      <tr>
                        <th scope="col">Sıra</th>
                        <th scope="col">Ürün Adı</th>
                        <th scope="col" className="align-right">Porsiyon</th>
                        <th scope="col" className="align-right">Toplam Satış</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.EnCokSatan.map((p, idx) => (
                        <tr key={p.StokAdi}>
                          <td className="rank-cell">
                            <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                          </td>
                          <td>
                            <strong>{p.StokAdi}</strong>
                          </td>
                          <td className="align-right">
                            <span className="qty-tag">{p.ToplamMiktar} Adet</span>
                          </td>
                          <td className="align-right font-numeric">
                            <strong>{money(p.ToplamTutar)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>Seçilen tarihte satışı tamamlanmış ürün kaydı bulunmuyor.</Empty>
              )}
            </section>
          </div>

          <section className="mgmt-panel full-width" aria-label="Saatlik satış ve yoğunluk dağılımı">
            <div className="panel-title-bar">
              <div>
                <h2>Saatlik Satış ve Yoğunluk</h2>
                <p className="panel-sub">Kapanan adisyonların saat dilimlerine göre yoğunluğu.</p>
              </div>
            </div>

            {r.SaatlikCiro.length > 0 ? (
              <div className="table-scroll">
                <table className="craft-table">
                  <thead>
                    <tr>
                      <th scope="col">Saat Aralığı</th>
                      <th scope="col" className="align-right">Kapanan Adisyon</th>
                      <th scope="col" className="align-right">Saatlik Ciro</th>
                      <th scope="col">Yoğunluk Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.SaatlikCiro.map(s => {
                      const maxHourCiro = Math.max(...r.SaatlikCiro.map(h => h.Ciro), 1);
                      const percent = Math.round((s.Ciro / maxHourCiro) * 100);
                      return (
                        <tr key={s.Saat}>
                          <td>
                            <strong>
                              {String(s.Saat).padStart(2, '0')}:00 – {String((s.Saat + 1) % 24).padStart(2, '0')}:00
                            </strong>
                          </td>
                          <td className="align-right">
                            <span className="tag-pill">{s.AdisyonSayisi} Masa</span>
                          </td>
                          <td className="align-right font-numeric">
                            <strong>{money(s.Ciro)}</strong>
                          </td>
                          <td>
                            <div className="hour-bar-track">
                              <div className="hour-bar-fill" style={{width: `${percent}%`}}/>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Seçilen tarihte saatlik tahsilat kaydı bulunamadı.</Empty>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function Reservations() {
  const client = useQueryClient();
  const [date, setDate] = useState(localDate());
  const [create, setCreate] = useState(false);
  const [cancel, setCancel] = useState<Reservation | null>(null);

  const list = useQuery({
    queryKey: ['reservations', date],
    queryFn: () => api<Reservation[]>(`/rezervasyonlar?tarih=${date}`),
    refetchInterval: 15000
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/rezervasyonlar/${id}`, {method: 'DELETE'}),
    onSuccess: async () => {
      await client.invalidateQueries();
      setCancel(null);
    }
  });

  return (
    <section className="mgmt-section" aria-label="Masa rezervasyonları">
      <div className="page-heading">
        <div>
          <h1>Rezervasyonlar</h1>
          <p>Misafir masa rezervasyonları ve salon planlaması.</p>
        </div>
        <div className="heading-actions">
          <label className="date-picker-label">
            <span>Tarih:</span>
            <input
              type="date"
              aria-label="Rezervasyon tarihi"
              value={date}
              onChange={e => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <button type="button" className="modal-btn primary" onClick={() => setCreate(true)}>
            <Plus size={16} aria-hidden="true"/>
            <span>Yeni Rezervasyon</span>
          </button>
        </div>
      </div>

      <ErrorBox error={list.error} retry={() => void list.refetch()}/>

      {list.isPending ? (
        <Loading/>
      ) : list.data?.length ? (
        <div className="mgmt-panel full-width">
          <div className="table-scroll">
            <table className="craft-table">
              <thead>
                <tr>
                  <th scope="col">Saat</th>
                  <th scope="col">Misafir Adı</th>
                  <th scope="col">Rezerve Masa</th>
                  <th scope="col">Kişi</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">Özel Not</th>
                  <th scope="col" className="align-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map(r => (
                  <tr key={r.KayitNo}>
                    <td>
                      <span className="time-badge">
                        <Clock size={12} aria-hidden="true"/>
                        <span>{new Date(r.RezervasyonTarihi).toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'})}</span>
                      </span>
                    </td>
                    <td>
                      <strong className="guest-name">{r.MusteriAdi}</strong>
                    </td>
                    <td>
                      <span className="table-badge">{r.MasaAdi}</span>
                    </td>
                    <td>
                      <span className="guest-count">
                        <Users size={13} aria-hidden="true"/>
                        <span>{r.KisiSayisi} Kişi</span>
                      </span>
                    </td>
                    <td>{r.Telefon || '—'}</td>
                    <td>{r.Aciklama || '—'}</td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${r.MusteriAdi} rezervasyonunu iptal et`}
                        onClick={() => setCancel(r)}
                        title="Rezervasyonu İptal Et"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Empty>
          <CalendarDays size={40} strokeWidth={1.3}/>
          <h3>Bu tarihte kayıtlı rezervasyon bulunmuyor</h3>
          <p>Yeni bir misafir rezervasyonu oluşturarak masayı güvenceye alabilirsiniz.</p>
          <button type="button" className="modal-btn primary" onClick={() => setCreate(true)}>
            <Plus size={16} aria-hidden="true"/>
            <span>Rezervasyon Oluştur</span>
          </button>
        </Empty>
      )}

      {create && <ReservationForm date={date} close={() => setCreate(false)}/>}

      {cancel && (
        <Modal
          title="Rezervasyonu İptal Et"
          onClose={() => {
            if (!remove.isPending) setCancel(null);
          }}
        >
          <div className="modal-body-stack">
            <p className="modal-desc">
              <strong>{cancel.MusteriAdi}</strong> için açılan <strong>{cancel.MasaAdi}</strong> rezervasyonu silinecektir. Bu işlem geri alınamaz.
            </p>
            <ErrorBox error={remove.error}/>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                disabled={remove.isPending}
                onClick={() => setCancel(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="modal-btn danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(cancel.KayitNo)}
              >
                {remove.isPending ? 'İptal Ediliyor…' : 'Rezervasyonu İptal Et'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function ReservationForm({date, close}: {date: string; close: () => void}) {
  const client = useQueryClient();
  const tables = useQuery({queryKey: ['tables'], queryFn: () => api<Table[]>('/masalar')});

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [time, setTime] = useState(`${date}T19:00`);
  const [table, setTable] = useState('');
  const [people, setPeople] = useState('2');
  const [note, setNote] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api('/rezervasyonlar', {
        method: 'POST',
        body: JSON.stringify({
          MasaKayitNo: Number(table),
          MusteriAdi: name.trim(),
          Telefon: phone.trim(),
          RezervasyonTarihi: new Date(time).toISOString(),
          KisiSayisi: Number(people),
          Aciklama: note.trim()
        })
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
      close();
    }
  });

  return (
    <Modal
      title="Yeni Masa Rezervasyonu"
      onClose={() => {
        if (!create.isPending) close();
      }}
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          create.mutate();
        }}
        className="craft-form"
      >
        <label>
          Misafir Adı ve Soyadı
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="Örn: Ayşe Demir"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>

        <div className="form-row">
          <label>
            Rezerve Edilecek Masa
            <select
              required
              value={table}
              onChange={e => setTable(e.target.value)}
            >
              <option value="">Masa seçin…</option>
              {tables.data?.filter(t => !t.BirlesmisMasa).map(t => (
                <option key={t.MasaId} value={t.MasaId}>
                  {t.MasaAdi} ({t.RestorantBolumAdi})
                </option>
              ))}
            </select>
          </label>

          <label>
            Kişi Sayısı
            <input
              required
              type="number"
              min="1"
              max="30"
              value={people}
              onChange={e => setPeople(e.target.value)}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Rezervasyon Tarih & Saat
            <input
              required
              type="datetime-local"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </label>

          <label>
            İletişim Telefonu
            <input
              type="tel"
              maxLength={30}
              placeholder="05XX XXX XX XX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </label>
        </div>

        <label>
          Özel İstek / Rezervasyon Notu
          <textarea
            maxLength={250}
            rows={3}
            placeholder="Örn: Cam kenarı masa tercihi, doğum günü kutlaması…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </label>

        <ErrorBox error={tables.error || create.error}/>

        <div className="modal-actions">
          <button type="button" className="modal-btn secondary" disabled={create.isPending} onClick={close}>
            Vazgeç
          </button>
          <button
            type="submit"
            className="modal-btn primary"
            disabled={create.isPending || !tables.data || !name.trim() || !table}
          >
            {create.isPending ? 'Kaydediliyor…' : 'Rezervasyonu Tamamla'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
