import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Search, Plus, Utensils, Check, X} from 'lucide-react';
import {api, money} from './api';
import type {Category, Product} from './types';
import {Empty, ErrorBox, Loading} from './ui';
import './menu.css';

export function MenuPage({
  onAdd,
  publicView = false,
  busy = false
}: {
  onAdd?: (p: Product) => void;
  publicView?: boolean;
  busy?: boolean;
}) {
  const menu = useQuery({
    queryKey: ['menu'],
    queryFn: () => api<Category[]>('/menu')
  });

  const [category, setCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [addedItem, setAddedItem] = useState<number | null>(null);

  const categories = menu.data ?? [];
  const totalProducts = categories.reduce((acc, c) => acc + c.Urunler.length, 0);

  const products = categories
    .filter(c => category === null || category === c.KayitNo)
    .flatMap(c => c.Urunler)
    .filter(p => p.Aktif && p.StokAdi.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));

  const handleAdd = (p: Product) => {
    if (!onAdd || busy) return;
    onAdd(p);
    setAddedItem(p.KayitNo);
    setTimeout(() => setAddedItem(null), 1200);
  };

  return (
    <section className={`menu-showcase ${onAdd ? 'picker-mode' : ''}`} aria-label="Ürün menüsü kataloğu">
      {!onAdd && !publicView && (
        <div className="page-heading">
          <div>
            <h1>Menü</h1>
            <p>Servise açık tüm ürünler ve güncel fiyat listesi.</p>
          </div>
          <div className="menu-stats-pill">
            <Utensils size={14} aria-hidden="true"/>
            <strong>{totalProducts}</strong>
            <span>ürün serviste</span>
          </div>
        </div>
      )}

      <div className="menu-nav-bar">
        <div className="menu-search-wrapper">
          <Search size={16} className="search-icon" aria-hidden="true"/>
          <input
            type="search"
            aria-label="Menüde ürün ara"
            placeholder="Ürün adı ara (çorba, köfte, meze, tatlı)…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
              aria-label="Aramayı temizle"
            >
              <X size={14}/>
            </button>
          )}
        </div>

        <div className="category-scroll-tabs" role="tablist" aria-label="Menü kategorileri">
          <button
            type="button"
            role="tab"
            aria-selected={category === null}
            className={`cat-pill ${category === null ? 'selected' : ''}`}
            onClick={() => setCategory(null)}
          >
            <span>Tüm ürünler</span>
            <span className="cat-count">{totalProducts}</span>
          </button>
          {categories.map(c => (
            <button
              key={c.KayitNo}
              type="button"
              role="tab"
              aria-selected={category === c.KayitNo}
              className={`cat-pill ${category === c.KayitNo ? 'selected' : ''}`}
              onClick={() => setCategory(c.KayitNo)}
            >
              <span>{c.GrupAdi}</span>
              <span className="cat-count">{c.Urunler.length}</span>
            </button>
          ))}
        </div>
      </div>

      <ErrorBox error={menu.error} retry={() => void menu.refetch()}/>

      {menu.isPending ? (
        <Loading/>
      ) : products.length === 0 ? (
        <Empty>
          <Utensils size={36} strokeWidth={1.3}/>
          <h3>Aradığınız kriterde ürün bulunamadı</h3>
          <p>Lütfen arama terimini değiştirin veya kategori filtresini kaldırın.</p>
          {search && (
            <button type="button" className="modal-btn secondary" onClick={() => setSearch('')}>
              Aramayı Temizle
            </button>
          )}
        </Empty>
      ) : (
        <div className="dish-grid">
          {products.map(p => {
            const isJustAdded = addedItem === p.KayitNo;

            return (
              <article className="dish-card" key={p.KayitNo}>
                <div className="dish-card-header">
                  <span className="dish-category-tag">{p.GrupAdi}</span>
                </div>

                <div className="dish-card-body">
                  <h3 className="dish-name">{p.StokAdi}</h3>
                </div>

                <div className="dish-card-footer">
                  <div className="dish-price-block">
                    <span className="price-label">Fiyat</span>
                    <strong className="dish-price">{money(p.SatisFiyati)}</strong>
                  </div>

                  {onAdd && (
                    <button
                      type="button"
                      disabled={busy}
                      className={`dish-add-btn ${isJustAdded ? 'added' : ''}`}
                      onClick={() => handleAdd(p)}
                      aria-label={`${p.StokAdi} adisyona ekle`}
                    >
                      {isJustAdded ? (
                        <>
                          <Check size={14} aria-hidden="true"/>
                          <span>Eklendi</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} aria-hidden="true"/>
                          <span>Ekle</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {publicView && (
        <footer className="public-menu-footer">
          <div className="allergen-box">
            <h4>Alerjen ve Tüketici Bilgilendirmesi</h4>
            <p>
              Tüm fiyatlarımız Türk Lirası cinsindendir ve KDV dahildir. Gıda alerjisi veya özel beslenme hassasiyetiniz varsa lütfen sipariş vermeden önce servis ekibimize bildiriniz.
            </p>
          </div>
        </footer>
      )}
    </section>
  );
}
