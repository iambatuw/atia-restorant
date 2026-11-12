import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,expect,it} from 'vitest';
import {ProductEditor} from './MenuEditor';
import type {Category,Product} from './types';

describe('product editor',()=>{
  it('groups reusable notes and blocks another portion while a row is incomplete',()=>{
    const product:Product={KayitNo:12,StokAdi:'Çiğ köfte',SatisFiyati:150,GrupKayitNo:1,GrupAdi:'Başlangıçlar',
      Aktif:true,Porsiyonlar:[{KayitNo:1,PorsiyonAdi:'',Fiyat:0,Carpan:1}],HazirNotlar:['Turşusuz']};
    const categories:Category[]=[{KayitNo:1,GrupAdi:'Başlangıçlar',Urunler:[product]}];
    const client=new QueryClient();
    client.setQueryData(['settings'],{HazirNotlar:['Turşusuz','Paket yapılacak'],
      HazirNotTanimlari:[{Ad:'Turşusuz',Grup:'Malzeme'},{Ad:'Paket yapılacak',Grup:'Servis'}]});
    const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},
      createElement(ProductEditor,{categories,product,close:()=>{}})));

    expect(html).toContain('Yeni hazır not tanımla');
    expect(html).toContain('Turşusuz');
    expect(html).toContain('Malzeme');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Porsiyon ekle<\/button>/);
    expect(html).toContain('mevcut porsiyonun adını');
  });
});
