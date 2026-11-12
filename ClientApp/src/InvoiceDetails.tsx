import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from './api';
import type {Account,InvoiceDetails,Receipt} from './types';
import {ErrorBox,Modal} from './ui';

/** Company details printed on the customer bill (unvan, vergi dairesi, vergi no, adres). */
export function InvoiceDetailsDialog({receipt,admin,close}:{receipt:Receipt;admin:boolean;close:()=>void}){
  const client=useQueryClient();
  const accounts=useQuery({queryKey:['accounts',''],queryFn:()=>api<Account[]>('/cari'),enabled:admin});
  const current=receipt.FaturaBilgisi;
  const [form,setForm]=useState<InvoiceDetails>({Unvan:current?.Unvan??'',VergiDairesi:current?.VergiDairesi??'',VergiNo:current?.VergiNo??'',Adres:current?.Adres??''});
  const set=(key:keyof InvoiceDetails)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[key]:e.target.value}));
  const save=useMutation({mutationFn:(body:InvoiceDetails|null)=>api(`/adisyonlar/${receipt.KayitNo}/fatura-bilgisi`,{method:'PUT',body:JSON.stringify(body)}),
    onSuccess:async()=>{await client.invalidateQueries();close();}});
  const taxValid=!form.VergiNo||/^\d{10,11}$/.test(form.VergiNo);
  const withTax=(accounts.data??[]).filter(a=>a.Aktif&&a.VergiNo);
  return <Modal title={`Adisyon #${receipt.KayitNo} · fatura bilgisi`} onClose={close}><form className="craft-form" onSubmit={e=>{e.preventDefault();save.mutate(form);}}>
    <p className="op-note">Bilgi fişinde müşteri bilgisi olarak yazılır. Mali fatura veya e-Adisyon düzenlemez.</p>
    {withTax.length>0&&<label>Cari hesaptan doldur<select value="" onChange={e=>{const a=withTax.find(x=>String(x.KayitNo)===e.target.value);if(a)setForm({Unvan:a.Unvan,VergiDairesi:a.VergiDairesi??'',VergiNo:a.VergiNo??'',Adres:a.Adres??''});}}>
      <option value="">Seçin</option>{withTax.map(a=><option key={a.KayitNo} value={a.KayitNo}>{a.Unvan}</option>)}</select></label>}
    <label>Unvan<input autoFocus required maxLength={120} value={form.Unvan} onChange={set('Unvan')}/></label>
    <div className="form-row"><label>Vergi dairesi<input maxLength={80} value={form.VergiDairesi??''} onChange={set('VergiDairesi')}/></label><label>Vergi / TC kimlik no<input inputMode="numeric" maxLength={11} value={form.VergiNo??''} onChange={set('VergiNo')}/></label></div>
    <label>Adres<input maxLength={300} value={form.Adres??''} onChange={set('Adres')}/></label>
    {!taxValid&&<p className="error-text" role="status">Vergi numarası 10, TC kimlik numarası 11 haneli olmalı.</p>}
    <ErrorBox error={save.error}/>
    <div className="dialog-actions">{current&&<button type="button" disabled={save.isPending} onClick={()=>save.mutate(null)}>Bilgiyi kaldır</button>}
      <button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={!form.Unvan.trim()||!taxValid||save.isPending}>Kaydet</button></div>
  </form></Modal>;
}
