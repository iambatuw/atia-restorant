import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  api,
  ApiError,
  localDate,
  money,
  setToken,
  toCents,
  masaTasi,
  masaAyir,
  masaBirlestir,
  masaOdeme,
  posIslemBaslat,
  posIslemSorgula,
  posIslemSimuleSonuc
} from './api';
afterEach(()=>{vi.unstubAllGlobals();setToken('');});
describe('Ödeme ve tarih yardımcıları',()=>{
 it('kuruşları tam sayı olarak hesaplar',()=>{expect(toCents('10,25')).toBe(1025);expect(toCents('0.10')).toBe(10);expect(toCents('0')).toBe(0);});
 it('negatif, boş, NaN ve fazla ondalığı reddeder',()=>{for(const value of ['-10','','abc','1.234','1e3','Infinity','1,2,3'])expect(toCents(value)).toBeNull();});
 it('yerel tarihi UTC kayması olmadan üretir',()=>{expect(localDate(new Date(2026,0,2,0,1))).toBe('2026-01-02');});
 it('TL biçiminde gösterir',()=>{expect(money(10.5)).toContain('10,50');expect(money(null)).toContain('0,00');});
});
describe('API taşıma sözleşmesi',()=>{
 it('PascalCase zarfı açar ve tokenı header olarak yollar',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({Success:true,Data:[1]})));vi.stubGlobal('fetch',fetcher);setToken('test-token');expect(await api('/menu')).toEqual([1]);expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');});
 it('ProblemDetails yanıtını kullanıcıya taşır',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'Tutar eşleşmiyor.'}),{status:409})));await expect(api('/payment')).rejects.toThrow('Tutar eşleşmiyor.');});
 it('erişilemeyen sunucu için anlaşılır hata döner',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));await expect(api('/health')).rejects.toBeInstanceOf(ApiError);});
});
describe('Masa ve POS işlemleri API sözleşmesi',()=>{
 it('masaTasi doğru endpoint ve body ile POST isteği gönderir',async()=>{
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({Success:true,Data:{KayitNo:101}})));
   vi.stubGlobal('fetch',fetcher);
   const res=await masaTasi({KaynakMasaKayitNo:1,HedefMasaKayitNo:2});
   expect(res).toEqual({KayitNo:101});
   expect(fetcher).toHaveBeenCalledWith('/api/masalar/tasi',expect.objectContaining({
     method:'POST',
     body:JSON.stringify({KaynakMasaKayitNo:1,HedefMasaKayitNo:2})
   }));
 });

 it('masaAyir doğru endpoint ve body ile POST isteği gönderir',async()=>{
   const mockResult={KaynakAdisyon:{KayitNo:1},HedefAdisyon:{KayitNo:2}};
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({Success:true,Data:mockResult})));
   vi.stubGlobal('fetch',fetcher);
   const req={MasaKayitNo:1,HedefMasaKayitNo:2,AyrilanSatirlar:[{DetayKayitNo:5,Miktar:1}]};
   const res=await masaAyir(req);
   expect(res).toEqual(mockResult);
   expect(fetcher).toHaveBeenCalledWith('/api/masalar/ayir',expect.objectContaining({
     method:'POST',
     body:JSON.stringify(req)
   }));
 });

 it('masaBirlestir doğru endpoint ve body ile POST isteği gönderir',async()=>{
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({Success:true,Data:{KayitNo:1}})));
   vi.stubGlobal('fetch',fetcher);
   const req={AnaMasaKayitNo:1,BirlestirilecekMasaKayitNolar:[2,3]};
   const res=await masaBirlestir(req);
   expect(res).toEqual({KayitNo:1});
   expect(fetcher).toHaveBeenCalledWith('/api/masalar/birlestir',expect.objectContaining({
     method:'POST',
     body:JSON.stringify(req)
   }));
 });

 it('masaOdeme kısmi veya tam ödeme isteğini masaya iletir',async()=>{
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({Success:true,Data:{KayitNo:1}})));
   vi.stubGlobal('fetch',fetcher);
   const req={
     BaslikKayitNo:1,
     NakitTutar:100,
     BankaTutar:50,
     CariTutar:0,
     YemekKartiTutar:0,
     IndirimTutar:0,
     KismiOdeme:true,
     PosIslemId:'tx-123'
   };
   const res=await masaOdeme(12,req);
   expect(res).toEqual({KayitNo:1});
   expect(fetcher).toHaveBeenCalledWith('/api/masalar/12/odeme',expect.objectContaining({
     method:'POST',
     body:JSON.stringify(req)
   }));
 });

 it('posIslemBaslat ve simule-onay çağrıları düzgün çalışır',async()=>{
   const mockTx={IslemId:'tx-123',Durum:1,Basarili:false};
   const fetcher=vi.fn()
     .mockResolvedValueOnce(new Response(JSON.stringify({Success:true,Data:mockTx})))
     .mockResolvedValueOnce(new Response(JSON.stringify({Success:true,Data:{...mockTx,Durum:1}})))
     .mockResolvedValueOnce(new Response(JSON.stringify({Success:true,Data:{...mockTx,Durum:2,Basarili:true}})));
   vi.stubGlobal('fetch',fetcher);

   const initRes=await posIslemBaslat({
     BaslikKayitNo:1,
     MasaKayitNo:2,
     Tutar:150,
     CihazTipi:1
   });
   expect(initRes.IslemId).toBe('tx-123');

   const statusRes=await posIslemSorgula('tx-123');
   expect(statusRes.Durum).toBe(1);
   expect(fetcher).toHaveBeenCalledWith('/api/pos/islem/tx-123',expect.objectContaining({headers:expect.any(Object)}));

   const approvedRes=await posIslemSimuleSonuc('tx-123',true);
   expect(approvedRes.Basarili).toBe(true);
   expect(fetcher).toHaveBeenCalledWith('/api/pos/islem/tx-123/simule-onay',expect.objectContaining({
     method:'POST',
     body:JSON.stringify({basarili:true})
   }));
 });
});
