import type {MasaAyirRequest,MasaAyirSonuc,MasaBirlestirRequest,MasaTasiRequest,OdemeRequest,PosIslemIstek,PosIslemKayit,Receipt,Session} from './types';
let token = '';
export function setToken(value:string) {token=value;}
export function getToken() {return token;}
export class ApiError extends Error { constructor(message:string, public status:number) {super(message);} }
export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  let response:Response;
  const requestToken=token;
  try {response=await fetch(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...(requestToken?{Authorization:`Bearer ${requestToken}`} : {}),...options.headers}});} catch {throw new ApiError('Sunucuya ulaşılamıyor. API bağlantısını kontrol edip yeniden deneyin.',0);}
  const data=await response.json().catch(()=>null);
  if(!response.ok){if(response.status===401 && requestToken && requestToken===token) window.dispatchEvent(new Event('auth-expired')); throw new ApiError(data?.detail ?? data?.Detail ?? data?.Message ?? data?.title ?? 'İşlem tamamlanamadı.',response.status);}
  if(!data?.Success) throw new ApiError(data?.Message ?? 'Sunucu yanıtı geçersiz.',response.status);
  return data.Data as T;
}
export function login(name:string,password:string) {return api<Session>('/auth/login',{method:'POST',body:JSON.stringify({KullaniciAdi:name,Sifre:password})});}
export const money=(value:number|null|undefined)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(value??0);
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function toCents(value:string){if(!/^\d+(?:[.,]\d{1,2})?$/.test(value))return null;return Math.round(Number(value.replace(',','.'))*100);}

// ───── MASA & POS İŞLEM API ÇAĞRILARI ─────
export function masaTasi(request: MasaTasiRequest) {
  return api<Receipt>('/masalar/tasi', { method: 'POST', body: JSON.stringify(request) });
}
export function masaAyir(request: MasaAyirRequest) {
  return api<MasaAyirSonuc>('/masalar/ayir', { method: 'POST', body: JSON.stringify(request) });
}
export function masaBirlestir(request: MasaBirlestirRequest) {
  return api<Receipt>('/masalar/birlestir', { method: 'POST', body: JSON.stringify(request) });
}
export function masaOdeme(tableId: number, request: OdemeRequest) {
  return api<Receipt>(`/masalar/${tableId}/odeme`, { method: 'POST', body: JSON.stringify(request) });
}
export function posIslemBaslat(request: PosIslemIstek) {
  return api<PosIslemKayit>('/pos/islem', { method: 'POST', body: JSON.stringify(request) });
}
export function posIslemSorgula(islemId: string) {
  return api<PosIslemKayit>(`/pos/islem/${islemId}`);
}
export function posIslemSimuleSonuc(islemId: string, basarili = true, hataMesaji?: string) {
  return api<PosIslemKayit>(`/pos/islem/${islemId}/simule-onay`, {
    method: 'POST',
    body: JSON.stringify({ basarili, hataMesaji })
  });
}

