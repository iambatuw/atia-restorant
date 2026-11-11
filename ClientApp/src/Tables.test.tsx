import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,expect,it} from 'vitest';
import {Tables} from './Tables';
import type {Session,Table} from './types';

const table:Table={MasaId:12,MasaAdi:'Masa 12',MasaKodu:'12',RestorantBolumuKayitNo:1,
  RestorantBolumAdi:'Salon',BaslikKayitNo:null,Tutar:null,KisiSayisi:0,AcilisTarihi:null,
  Rezerve:false,BirlesmisMasa:false,AnaMasa:true,Durumu:0};
const session:Session={Token:'demo',KullaniciAdi:'garson',Rol:'Garson',KullaniciId:2,TamAd:'Demo Garson'};

describe('table product route',()=>{
  it('keeps the selected table and its receipt behind the product picker',()=>{
    const client=new QueryClient();
    client.setQueryData(['tables'],[table]);
    client.setQueryData(['sections'],[]);
    const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},
      createElement(Tables,{session,path:'/app/masalar/12/urun-ekle',navigate:()=>{}})));

    expect(html).toContain('aria-label="Masalar"');
    expect(html).toContain('class="order-panel guest-check-panel fresh-check"');
    expect(html).toMatch(/<dialog[^>]*class="table-product-dialog"/);
    expect(html).toContain('Onayla ve ekle');
  });
});
