import {useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Minus,Plus,Search,ShoppingBag,Trash2} from 'lucide-react';
import {api,money,toCents} from './api';
import type {Account,Category,FullSettings,Product,Receipt} from './types';
import {Empty,ErrorBox,Loading} from './ui';
import {OptionChooser} from './Options';
import {BillPrint} from './Barcode';
import './Extensions.css';

type CartLine={id:number;product:Product;portionId?:number;portionName?:string;options:number[];optionText:string;price:number;quantity:number};
type Method='cash'|'card'|'meal'|'account';

/** Counter / takeaway sale: pick products, take payment, the kitchen still receives the order. */
export default function QuickSalePage(){
  const client=useQueryClient();
  const menu=useQuery({queryKey:['menu','public'],queryFn:()=>api<Category[]>('/menu')});
  const settings=useQuery({queryKey:['settings'],queryFn:()=>api<FullSettings>('/ayarlar')});
  const accounts=useQuery({queryKey:['accounts',''],queryFn:()=>api<Account[]>('/cari')});
  const [category,setCategory]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [portionFor,setPortionFor]=useState<Product|null>(null);
  const [optionFor,setOptionFor]=useState<{product:Product;portionId?:number}|null>(null);
  const [cart,setCart]=useState<CartLine[]>([]);
  const [customer,setCustomer]=useState('');
  const [method,setMethod]=useState<Method>('cash');
  const [mealCard,setMealCard]=useState('');
  const [account,setAccount]=useState('');
  const [discount,setDiscount]=useState('');
  const [key,setKey]=useState(()=>crypto.randomUUID());
  const [last,setLast]=useState<Receipt|null>(null);
  const [printing,setPrinting]=useState(false);
  const nextId=useRef(0);
  const categories=menu.data??[];
  const query=search.trim().toLocaleLowerCase('tr');
  const products=categories.filter(c=>category===null||c.KayitNo===category).flatMap(c=>c.Urunler)
    .filter(p=>p.StokAdi.toLocaleLowerCase('tr').includes(query)||(!!p.Barkod&&p.Barkod===search.trim()));
  const total=cart.reduce((sum,line)=>sum+Math.round(line.price*line.quantity*100),0);
  const discountCents=discount.trim()?toCents(discount):0;
  const payCents=total-(discountCents??0);
  const activeCards=(settings.data?.YemekKartlari??[]).filter(c=>c.Aktif);
  const activeAccounts=(accounts.data??[]).filter(a=>a.Aktif);
  const blocked=cart.length===0||discountCents===null||payCents<0||(method==='meal'&&activeCards.length>0&&!mealCard)||(method==='account'&&!account);

  const add=(product:Product,portionId?:number,options?:number[])=>{
    if(product.Porsiyonlar.length>0&&portionId===undefined){setPortionFor(product);setOptionFor(null);return;}
    if((product.SecenekGruplari?.length??0)>0&&options===undefined){setPortionFor(null);setOptionFor({product,portionId});return;}
    const portion=product.Porsiyonlar.find(p=>p.KayitNo===portionId);
    const chosen=(product.SecenekGruplari??[]).flatMap(g=>g.Secenekler).filter(o=>options?.includes(o.KayitNo));
    setCart(lines=>[...lines,{id:++nextId.current,product,portionId,portionName:portion?.PorsiyonAdi,options:chosen.map(o=>o.KayitNo),
      optionText:chosen.map(o=>o.Ad).join(', '),price:(portion?.Fiyat??product.SatisFiyati)+chosen.reduce((s,o)=>s+o.EkFiyat,0),quantity:1}]);
    setPortionFor(null);setOptionFor(null);setLast(null);
  };
  const sale=useMutation({
    mutationFn:()=>{
      const amount=payCents/100;
      return api<Receipt>('/hizli-satis',{method:'POST',body:JSON.stringify({IdempotencyKey:key,MusteriAdi:customer.trim()||null,
        Satirlar:cart.map(l=>({StokKayitNo:l.product.KayitNo,PorsiyonKayitNo:l.portionId,Miktar:l.quantity,SecenekKayitNolar:l.options})),
        NakitTutar:method==='cash'?amount:0,BankaTutar:method==='card'?amount:0,YemekKartiTutar:method==='meal'?amount:0,CariTutar:method==='account'?amount:0,
        IndirimTutar:(discountCents??0)/100,YemekKartiKayitNo:method==='meal'&&mealCard?Number(mealCard):null,CariHesapKayitNo:method==='account'?Number(account):null})});
    },
    onSuccess:async receipt=>{setLast(receipt);setCart([]);setCustomer('');setDiscount('');setKey(crypto.randomUUID());await client.invalidateQueries();}
  });

  return <section className="op-page" aria-label="Hızlı satış">
    <header className="op-page-head"><div><h1>Hızlı satış</h1><p>Masa açmadan tezgâhtan veya gel-al satış. Ödeme hemen alınır, sipariş mutfağa düşer.</p></div></header>
    <ErrorBox error={menu.error||settings.error} retry={()=>void menu.refetch()}/>
    <div className="op-quick-layout">
      <div className="op-stack">
        <div><label className="op-search op-quick-search"><Search size={17}/><input type="search" value={search} placeholder="Ürün ara veya barkod okutun" aria-label="Ürün ara"
          onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){const hit=products.find(p=>p.Barkod===search.trim());if(hit){e.preventDefault();setSearch('');add(hit);}}}}/></label></div>
        <div className="op-chip-row" role="group" aria-label="Kategoriler"><button className="op-chip" aria-pressed={category===null} onClick={()=>setCategory(null)}>Tümü</button>
          {categories.map(c=><button key={c.KayitNo} className="op-chip" aria-pressed={category===c.KayitNo} onClick={()=>setCategory(c.KayitNo)}>{c.GrupAdi}</button>)}</div>
        {portionFor&&<section className="op-option-panel" aria-label="Porsiyon"><header><strong>{portionFor.StokAdi}</strong><span>Porsiyon seçin</span></header>
          <div className="op-chip-row">{portionFor.Porsiyonlar.map(p=><button key={p.KayitNo} className="op-chip" onClick={()=>add(portionFor,p.KayitNo)}>{p.PorsiyonAdi}<small>{money(p.Fiyat)}</small></button>)}</div>
          <footer><button className="secondary" onClick={()=>setPortionFor(null)}>Vazgeç</button></footer></section>}
        {optionFor&&<OptionChooser key={`${optionFor.product.KayitNo}-${optionFor.portionId??0}`} product={optionFor.product}
          basePrice={optionFor.product.Porsiyonlar.find(p=>p.KayitNo===optionFor.portionId)?.Fiyat??optionFor.product.SatisFiyati}
          onCancel={()=>setOptionFor(null)} onConfirm={ids=>add(optionFor.product,optionFor.portionId,ids)}/>}
        {menu.isPending?<Loading/>:products.length===0?<Empty>Bu aramada ürün yok.</Empty>:
          <div className="op-quick-grid">{products.map(p=><button key={p.KayitNo} className="op-quick-product" onClick={()=>add(p)}><span>{p.GrupAdi}</span><strong>{p.StokAdi}</strong><b>{money(p.SatisFiyati)}</b></button>)}</div>}
      </div>
      <aside className="op-panel op-quick-cart" aria-label="Sepet">
        <div className="op-panel-head"><h2>Sepet</h2><small>{cart.reduce((s,l)=>s+l.quantity,0)} ürün</small></div>
        {cart.length===0?<div className="op-inline-empty">{last?`#${last.KayitNo} kaydedildi ve mutfağa gönderildi.`:'Ürünlere dokunarak sepete ekleyin.'}
          {last&&<div className="dialog-actions"><button className="secondary" onClick={()=>setPrinting(true)}>Fişi yazdır</button></div>}</div>:
          <div className="op-quick-lines">{cart.map(line=><div className="op-split-row" key={line.id}>
            <div><strong>{line.product.StokAdi}{line.portionName?` · ${line.portionName}`:''}</strong><small>{line.optionText||money(line.price)}</small></div>
            <span className="op-stepper"><button aria-label={`${line.product.StokAdi} azalt`} onClick={()=>setCart(c=>line.quantity<=1?c.filter(l=>l.id!==line.id):c.map(l=>l.id===line.id?{...l,quantity:l.quantity-1}:l))}>{line.quantity<=1?<Trash2 size={15}/>:<Minus size={15}/>}</button>
              <strong>{line.quantity}</strong><button aria-label={`${line.product.StokAdi} artır`} disabled={line.quantity>=100} onClick={()=>setCart(c=>c.map(l=>l.id===line.id?{...l,quantity:l.quantity+1}:l))}><Plus size={15}/></button></span>
            <b>{money(line.price*line.quantity)}</b></div>)}</div>}
        <div className="op-quick-pay">
          <label>Müşteri adı (isteğe bağlı)<input maxLength={60} value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Siparişi çağırmak için"/></label>
          <label>İndirim<input inputMode="decimal" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0,00"/></label>
          <div className="op-chip-row" role="group" aria-label="Ödeme şekli">{([['cash','Nakit'],['card','Kart'],['meal','Yemek kartı'],['account','Cari']] as const).map(([id,label])=>
            <button key={id} type="button" className="op-chip" aria-pressed={method===id} onClick={()=>setMethod(id)}>{label}</button>)}</div>
          {method==='meal'&&activeCards.length>0&&<label>Yemek kartı<select value={mealCard} onChange={e=>setMealCard(e.target.value)}><option value="">Kart seçin</option>{activeCards.map(c=><option key={c.KayitNo} value={c.KayitNo}>{c.Ad}</option>)}</select></label>}
          {method==='account'&&<label>Cari hesap<select value={account} onChange={e=>setAccount(e.target.value)}><option value="">Hesap seçin</option>{activeAccounts.map(a=><option key={a.KayitNo} value={a.KayitNo}>{a.Unvan} ({money(a.Bakiye)})</option>)}</select></label>}
          <div className="payment-breakdown-card"><div className="payment-breakdown-row highlight"><span>Tahsil edilecek</span><strong>{money(Math.max(0,payCents)/100)}</strong></div></div>
          <ErrorBox error={sale.error}/>
          <button className="primary full" disabled={blocked||sale.isPending} onClick={()=>sale.mutate()}><ShoppingBag size={17}/> {sale.isPending?'Kaydediliyor…':'Ödemeyi al ve mutfağa gönder'}</button>
        </div>
      </aside>
    </div>
    {printing&&last&&<BillPrint receipt={last} store={settings.data?.Isletme} onDone={()=>setPrinting(false)}/>}
  </section>;
}
