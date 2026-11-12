import {useEffect,useRef} from 'react';
import {money} from './api';
import type {Receipt,StoreProfile,VatRow} from './types';

// Code 39 patterns for digits and the start/stop character. Nine elements (bar, space, bar, ...); 1 = wide.
const CODE39:Record<string,string>={
  '0':'000110100','1':'100100001','2':'001100001','3':'101100000','4':'000110001',
  '5':'100110000','6':'001110000','7':'000100101','8':'100100100','9':'001100100','*':'010010100'
};

/** Bars of a Code 39 barcode for a receipt number; a keyboard-wedge scanner types the digits back. */
export function code39Bars(value:string):{x:number;width:number}[]{
  if(!/^\d{1,18}$/.test(value)) throw new Error('Barkod yalnızca rakam içerebilir.');
  const bars:{x:number;width:number}[]=[];
  let x=0;
  for(const char of `*${value}*`){
    const pattern=CODE39[char];
    for(let i=0;i<pattern.length;i++){
      const width=pattern[i]==='1'?3:1;
      if(i%2===0) bars.push({x,width});
      x+=width;
    }
    x+=1; // Narrow gap between characters.
  }
  return bars;
}

export function Barcode({value,label}:{value:string;label?:string}){
  const bars=code39Bars(value);
  const width=bars.length?bars[bars.length-1].x+bars[bars.length-1].width:0;
  return <svg className="barcode-svg" viewBox={`-10 0 ${width+20} 40`} preserveAspectRatio="none" role="img" aria-label={label??`Barkod ${value}`}>
    <rect x={-10} y={0} width={width+20} height={40} fill="#fff"/>
    {bars.map(bar=><rect key={bar.x} x={bar.x} y={0} width={bar.width} height={40} fill="#000"/>)}
  </svg>;
}

/** Printable customer bill. Mounted only while printing so it never leaks into other print jobs. */
export function BillPrint({receipt,store,onDone}:{receipt:Receipt;store?:StoreProfile;onDone:()=>void}){
  const done=useRef(onDone);
  done.current=onDone;
  useEffect(()=>{
    const finish=()=>done.current();
    window.addEventListener('afterprint',finish);
    const timer=window.setTimeout(()=>window.print(),0);
    return ()=>{window.clearTimeout(timer);window.removeEventListener('afterprint',finish);};
  },[]);
  const paid=(receipt.NakitToplam??0)+(receipt.BankaToplam??0)+(receipt.CariToplam??0)+(receipt.YemekKartiToplam??0);
  const discount=receipt.IndirimToplam??0;
  const vat:VatRow[]=receipt.KdvDokumu??[];
  return <div className="bill-print" aria-hidden="true">
    <h1>{store?.Unvan??'ATIA Restoran'}</h1>
    {store?.Adres&&<p className="center">{store.Adres}</p>}
    {store?.Telefon&&<p className="center">Tel: {store.Telefon}</p>}
    {(store?.VergiDairesi||store?.VergiNo)&&<p className="center">{[store?.VergiDairesi,store?.VergiNo].filter(Boolean).join(' · ')}</p>}
    <hr/>
    {receipt.FaturaBilgisi&&<><p>Müşteri: {receipt.FaturaBilgisi.Unvan}</p>{(receipt.FaturaBilgisi.VergiDairesi||receipt.FaturaBilgisi.VergiNo)&&<p>{[receipt.FaturaBilgisi.VergiDairesi,receipt.FaturaBilgisi.VergiNo].filter(Boolean).join(' · ')}</p>}{receipt.FaturaBilgisi.Adres&&<p>{receipt.FaturaBilgisi.Adres}</p>}<hr/></>}
    <p>{receipt.MasaAdi} · Adisyon #{receipt.KayitNo}</p>
    <p>{new Date().toLocaleString('tr-TR')} · {receipt.KisiSayisi} kişi</p>
    <table><tbody>{receipt.Detaylar.map(line=><tr key={line.KayitNo}>
      <td>{line.Miktar} × {line.StokAdi}{line.PorsiyonAdi?` (${line.PorsiyonAdi})`:''}{line.SecimMetni?<><br/>  {line.SecimMetni}</>:null}</td>
      <td>{line.Ikram?'İkram':money(line.SatirTutari)}</td>
    </tr>)}</tbody></table>
    <hr/>
    <table><tbody>
      {discount>0&&<tr><td>İndirim</td><td>-{money(discount)}</td></tr>}
      <tr className="total"><td>TOPLAM</td><td>{money(receipt.GenelToplam-discount)}</td></tr>
      {paid>0&&<tr><td>Ödenen</td><td>{money(paid)}</td></tr>}
      {paid>0&&receipt.GenelToplam-discount-paid>0&&<tr><td>Kalan</td><td>{money(receipt.GenelToplam-discount-paid)}</td></tr>}
      {vat.map(row=><tr key={row.Oran}><td>KDV %{row.Oran} (matrah {money(row.Matrah)})</td><td>{money(row.Kdv)}</td></tr>)}
    </tbody></table>
    <p className="center">Bu belge bilgi fişidir; mali değeri yoktur.</p>
    {store?.FisAltYazisi&&<p className="center">{store.FisAltYazisi}</p>}
    <Barcode value={String(receipt.KayitNo)} label={`Adisyon ${receipt.KayitNo}`}/>
    <p className="center">{receipt.KayitNo}</p>
  </div>;
}
