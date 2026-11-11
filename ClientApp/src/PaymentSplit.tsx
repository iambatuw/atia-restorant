import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Minus,Plus} from 'lucide-react';
import {masaOdeme,money} from './api';
import type {MealCard,OrderLine,Receipt,Table} from './types';
import {ErrorBox} from './ui';

export type SplitMethod='cash'|'card'|'meal';

/** One guest's share in cents. The last guest pays the rounding remainder. */
export function equalShare(remainingCents:number,guests:number):number{
  if(guests<=1) return remainingCents;
  return Math.floor(remainingCents/guests);
}

/** Same rule as the server: the last open unit of a line takes the rounding remainder. */
export function itemDueCents(line:Pick<OrderLine,'Miktar'|'BirimFiyat'|'SatirTutari'|'Ikram'|'OdenenMiktar'|'OdenenTutar'>,quantity:number):number{
  const open=line.Miktar-(line.OdenenMiktar??0);
  if(quantity<=0) return 0;
  if(quantity===open) return Math.round((line.SatirTutari-(line.OdenenTutar??0))*100);
  return line.Ikram?0:Math.round(quantity*line.BirimFiyat*100);
}

function methodBody(method:SplitMethod,cents:number){
  const amount=cents/100;
  return {NakitTutar:method==='cash'?amount:0,BankaTutar:method==='card'?amount:0,YemekKartiTutar:method==='meal'?amount:0,CariTutar:0,IndirimTutar:0};
}

function MethodPicker({method,setMethod,mealCards,card,setCard}:{method:SplitMethod;setMethod:(m:SplitMethod)=>void;mealCards:MealCard[];card:string;setCard:(v:string)=>void}){
  const active=mealCards.filter(c=>c.Aktif);
  return <>
    <div className="op-chip-row" role="group" aria-label="Ödeme şekli">
      {([['cash','Nakit'],['card','Kart (harici POS)'],['meal','Yemek kartı']] as const).map(([id,label])=>
        <button type="button" key={id} className="op-chip" aria-pressed={method===id} onClick={()=>setMethod(id)}>{label}</button>)}
    </div>
    {method==='meal'&&active.length>0&&<label className="field">Yemek kartı türü<select value={card} onChange={e=>setCard(e.target.value)}><option value="">Kart seçin</option>{active.map(c=><option key={c.KayitNo} value={c.KayitNo}>{c.Ad}</option>)}</select></label>}
    {method==='card'&&<p className="op-note">Bölünmüş ödemede kart tutarı harici POS’tan çekilir. Entegre POS için “Kısmi ödeme” sekmesini kullanın.</p>}
  </>;
}

export function SplitPaymentPanel({mode,receipt,table,mealCards,onClosed}:{mode:'equal'|'items';receipt:Receipt;table:Table;mealCards:MealCard[];onClosed:()=>void}){
  const client=useQueryClient();
  const paid=(receipt.NakitToplam??0)+(receipt.BankaToplam??0)+(receipt.CariToplam??0)+(receipt.YemekKartiToplam??0)+(receipt.IndirimToplam??0);
  const remainingCents=Math.max(0,Math.round((receipt.GenelToplam-paid)*100));
  const [guests,setGuests]=useState(Math.max(2,receipt.KisiSayisi||2));
  const [paidGuests,setPaidGuests]=useState(0);
  const [method,setMethod]=useState<SplitMethod>('cash');
  const [card,setCard]=useState('');
  const [picked,setPicked]=useState<Record<number,number>>({});
  const needsCard=method==='meal'&&mealCards.some(c=>c.Aktif)&&!card;
  const left=Math.max(1,guests-paidGuests);
  const share=equalShare(remainingCents,left);
  const openLines=receipt.Detaylar.filter(line=>line.Miktar-(line.OdenenMiktar??0)>0);
  const items=Object.entries(picked).filter(([,q])=>q>0).map(([id,q])=>({DetayKayitNo:Number(id),Miktar:q}));
  const itemCents=items.reduce((sum,item)=>{const line=receipt.Detaylar.find(l=>l.KayitNo===item.DetayKayitNo);return sum+(line?itemDueCents(line,item.Miktar):0);},0);
  const cents=mode==='equal'?share:itemCents;

  const pay=useMutation({
    mutationFn:()=>masaOdeme(table.MasaId,{BaslikKayitNo:receipt.KayitNo,...methodBody(method,cents),KismiOdeme:true,
      YemekKartiKayitNo:method==='meal'&&card?Number(card):null,OdenenSatirlar:mode==='items'?items:undefined}),
    onSuccess:async result=>{
      await client.invalidateQueries();
      if(result.Kapali){onClosed();return;}
      if(mode==='equal')setPaidGuests(n=>n+1);
      setPicked({});
    }
  });

  return <div className="op-stack">
    {mode==='equal'?<>
      <div className="op-guest-control"><span>Hesap kaç kişiye bölünecek?</span><span className="op-stepper">
        <button type="button" aria-label="Kişi sayısını azalt" disabled={guests<=Math.max(2,paidGuests+1)||pay.isPending} onClick={()=>setGuests(g=>g-1)}><Minus size={16}/></button>
        <strong>{guests}</strong>
        <button type="button" aria-label="Kişi sayısını artır" disabled={guests>=50||pay.isPending} onClick={()=>setGuests(g=>g+1)}><Plus size={16}/></button></span></div>
      <div className="payment-breakdown-card">
        <div className="payment-breakdown-row"><span>Ödeyen / toplam kişi</span><strong>{paidGuests} / {guests}</strong></div>
        <div className="payment-breakdown-row highlight"><span>Sıradaki kişinin payı{left===1?' (kalanın tamamı)':''}</span><strong>{money(share/100)}</strong></div>
      </div>
      <p className="op-note">Kuruş farkı son ödeyen kişiye eklenir. Her ödeme ayrı kayıt olarak kasaya işlenir.</p>
    </>:<>
      {openLines.length===0?<p className="op-note">Ödenmemiş ürün kalmadı.</p>:<div>{openLines.map(line=>{
        const open=line.Miktar-(line.OdenenMiktar??0);
        const q=picked[line.KayitNo]??0;
        const step=open<1?open:1;
        return <div className="op-split-row" key={line.KayitNo}>
          <div><strong>{line.StokAdi}{line.PorsiyonAdi?` · ${line.PorsiyonAdi}`:''}</strong><small>{open} ödenmemiş{(line.OdenenMiktar??0)>0?` · ${line.OdenenMiktar} ödendi`:''}{line.SecimMetni?` · ${line.SecimMetni}`:''}</small></div>
          <span className="op-stepper">
            <button type="button" aria-label={`${line.StokAdi} ödenecek adedi azalt`} disabled={q<=0||pay.isPending} onClick={()=>setPicked(p=>({...p,[line.KayitNo]:Math.max(0,+(q-step).toFixed(3))}))}><Minus size={15}/></button>
            <strong>{q}</strong>
            <button type="button" aria-label={`${line.StokAdi} ödenecek adedi artır`} disabled={q>=open||pay.isPending} onClick={()=>setPicked(p=>({...p,[line.KayitNo]:Math.min(open,+(q+step).toFixed(3))}))}><Plus size={15}/></button>
          </span>
          <b>{money(itemDueCents(line,q)/100)}</b>
        </div>;})}</div>}
      <div className="payment-breakdown-card"><div className="payment-breakdown-row highlight"><span>Seçilen ürünlerin tutarı</span><strong>{money(itemCents/100)}</strong></div></div>
    </>}
    <MethodPicker method={method} setMethod={setMethod} mealCards={mealCards} card={card} setCard={setCard}/>
    <ErrorBox error={pay.error}/>
    <div className="dialog-actions">
      <button type="button" className="primary" disabled={cents<=0||cents>remainingCents||needsCard||pay.isPending} onClick={()=>pay.mutate()}>
        {pay.isPending?'Kaydediliyor…':mode==='equal'?`${money(cents/100)} tahsil et`:`Seçilenleri öde (${money(cents/100)})`}
      </button>
    </div>
  </div>;
}
