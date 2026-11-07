import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Check, ChefHat, Clock3, Flame, Filter, CheckSquare, Square, AlertTriangle} from 'lucide-react';
import {api} from './api';
import type {KitchenTicket} from './types';
import {Empty, ErrorBox, Loading} from './ui';
import './kitchen.css';

export function Kitchen() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'urgent' | 'salon' | 'bahce'>('all');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const tickets = useQuery({
    queryKey: ['kitchen'],
    queryFn: () => api<KitchenTicket[]>('/mutfak'),
    refetchInterval: 10000
  });

  const ready = useMutation({
    mutationFn: (id: number) => api(`/mutfak/${id}/hazir`, {method: 'POST'}),
    onSuccess: () => {
      client.invalidateQueries();
    }
  });

  const toggleItemCheck = (detayKayitNo: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [detayKayitNo]: !prev[detayKayitNo]
    }));
  };

  const list = tickets.data ?? [];
  const urgentCount = list.filter(t => t.BeklemeSuresi >= 15).length;
  const maxWait = list.length > 0 ? Math.max(...list.map(t => t.BeklemeSuresi)) : 0;

  const filtered = list.filter(t => {
    if (filter === 'urgent') return t.BeklemeSuresi >= 15;
    if (filter === 'salon') return t.BolumAdi.toLowerCase().includes('salon');
    if (filter === 'bahce') return t.BolumAdi.toLowerCase().includes('bahçe');
    return true;
  });

  return (
    <section className="kds-section" aria-label="Mutfak sipariş yönetim ekranı">
      <div className="page-heading">
        <div>
          <h1>Mutfak</h1>
          <p>Bekleyen sipariş fişleri ve hazırlık sırası.</p>
        </div>

        <div className="kds-quick-metrics">
          <span className="kds-metric-chip">
            <span className="metric-num">{list.length}</span> fiş bekliyor
          </span>
          {urgentCount > 0 && (
            <span className="kds-metric-chip urgent">
              <span className="metric-num">{urgentCount}</span> gecikmeli (&gt;15 dk)
            </span>
          )}
          {maxWait > 0 && (
            <span className="kds-metric-chip">
              En eski: <span className="metric-num">{maxWait}</span> dk
            </span>
          )}
        </div>
      </div>

      <div className="kds-toolbar">
        <div className="kds-filters" role="group" aria-label="KDS filtreleri">
          <button
            type="button"
            className={`kds-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span>Tüm fişler</span>
            <span className="kds-count">{list.length}</span>
          </button>
          <button
            type="button"
            className={`kds-filter-btn ${filter === 'urgent' ? 'active' : ''} ${urgentCount > 0 ? 'has-urgent' : ''}`}
            onClick={() => setFilter('urgent')}
          >
            <Flame size={14} aria-hidden="true"/>
            <span>Gecikenler</span>
            <span className="kds-count">{urgentCount}</span>
          </button>
          <button
            type="button"
            className={`kds-filter-btn ${filter === 'salon' ? 'active' : ''}`}
            onClick={() => setFilter('salon')}
          >
            Salon
          </button>
          <button
            type="button"
            className={`kds-filter-btn ${filter === 'bahce' ? 'active' : ''}`}
            onClick={() => setFilter('bahce')}
          >
            Bahçe
          </button>
        </div>
      </div>

      <ErrorBox error={tickets.error || ready.error} retry={() => void tickets.refetch()}/>

      {tickets.isPending ? (
        <Loading/>
      ) : list.length === 0 ? (
        <Empty>
          <ChefHat size={40} strokeWidth={1.3}/>
          <h3>Bekleyen sipariş fişi yok</h3>
          <p>Garsonlar sipariş aldıkça veya masalara ürün eklendikçe fişler burada listelenir.</p>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          <Filter size={32} strokeWidth={1.3}/>
          <p>Seçilen filtreye uygun bekleyen fiş bulunamadı.</p>
        </Empty>
      ) : (
        <div className="kds-grid">
          {filtered.map(t => {
            const isLate = t.BeklemeSuresi >= 15;
            const isWarning = t.BeklemeSuresi >= 10 && !isLate;
            const isPendingMutation = ready.isPending && ready.variables === t.BaslikKayitNo;
            const checkedCount = t.Satirlar.filter(s => checkedItems[s.DetayKayitNo]).length;
            const allChecked = t.Satirlar.length > 0 && checkedCount === t.Satirlar.length;

            return (
              <article
                className={`kds-ticket ${isLate ? 'late' : isWarning ? 'warning' : 'fresh'}`}
                key={t.BaslikKayitNo}
              >
                <header className="kds-ticket-header">
                  <div className="kds-ticket-table">
                    <span className="kds-section-pill">{t.BolumAdi}</span>
                    <h2 className="kds-table-title">{t.MasaAdi}</h2>
                  </div>
                  <div className={`kds-wait-badge ${isLate ? 'late' : isWarning ? 'warning' : 'fresh'}`}>
                    <Clock3 size={13} aria-hidden="true"/>
                    <span>{t.BeklemeSuresi} dk</span>
                  </div>
                </header>

                <div className="kds-ticket-meta">
                  <span>Fiş #{t.BaslikKayitNo}</span>
                  <span>{checkedCount}/{t.Satirlar.length} hazır</span>
                </div>

                <div className="kds-ticket-body">
                  <ul className="kds-item-list">
                    {t.Satirlar.map(s => {
                      const isItemChecked = !!checkedItems[s.DetayKayitNo];
                      return (
                        <li
                          key={s.DetayKayitNo}
                          className={`kds-item ${isItemChecked ? 'completed' : ''}`}
                          onClick={() => toggleItemCheck(s.DetayKayitNo)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isItemChecked}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleItemCheck(s.DetayKayitNo);
                            }
                          }}
                        >
                          <div className="kds-item-check" aria-hidden="true">
                            {isItemChecked ? (
                              <CheckSquare size={17} className="check-done"/>
                            ) : (
                              <Square size={17} className="check-box"/>
                            )}
                          </div>
                          <span className="kds-qty">{s.KalanMiktar}×</span>
                          <div className="kds-item-details">
                            <strong className="kds-item-name">{s.StokAdi}</strong>
                            {s.SatirAciklama && (
                              <div className="kds-item-note">
                                <AlertTriangle size={12} aria-hidden="true"/>
                                <span>{s.SatirAciklama}</span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <footer className="kds-ticket-footer">
                  <button
                    type="button"
                    className={`kds-ready-btn ${allChecked ? 'all-ready' : ''}`}
                    disabled={ready.isPending}
                    onClick={() => ready.mutate(t.BaslikKayitNo)}
                  >
                    <Check size={16} strokeWidth={2.2} aria-hidden="true"/>
                    <span>{isPendingMutation ? 'Kaydediliyor…' : 'Sipariş Hazır'}</span>
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
