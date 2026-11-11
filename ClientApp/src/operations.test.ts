import {describe,expect,it} from 'vitest';
import {code39Bars} from './Barcode';
import {equalShare,itemDueCents} from './PaymentSplit';
import {optionProblem,toggleOption} from './Options';
import {toggleQuickNote} from './Tables';
import {canAccess,pageFromPath} from './routes';
import type {OptionGroup} from './types';

const groups:OptionGroup[]=[
  {KayitNo:1,Ad:'Şeker',Zorunlu:true,CokluSecim:false,Secenekler:[{KayitNo:11,Ad:'Sade',EkFiyat:0},{KayitNo:12,Ad:'Orta',EkFiyat:0}]},
  {KayitNo:2,Ad:'Ekstralar',Zorunlu:false,CokluSecim:true,Secenekler:[{KayitNo:21,Ad:'Kaşar',EkFiyat:30},{KayitNo:22,Ad:'Sos',EkFiyat:10}]}
];

describe('receipt barcode',()=>{
  it('encodes digits as Code 39 with start and stop characters',()=>{
    const bars=code39Bars('1001');
    expect(bars).toHaveLength(6*5); // Five bars per character, including both asterisks.
    expect(bars.filter(bar=>bar.width===3)).toHaveLength(6*2); // Each digit and '*' has two wide bars.
    expect(()=>code39Bars('A1')).toThrow();
  });
});

describe('split payments',()=>{
  it('gives the rounding remainder to the last guest',()=>{
    expect(equalShare(10000,3)).toBe(3333);
    expect(equalShare(6667,2)).toBe(3333);
    expect(equalShare(3334,1)).toBe(3334);
  });
  it('mirrors the server line rule for item payments',()=>{
    const line={Miktar:3,BirimFiyat:33.33,SatirTutari:99.99,Ikram:false,OdenenMiktar:2,OdenenTutar:66.66};
    expect(itemDueCents(line,1)).toBe(3333);
    expect(itemDueCents({...line,OdenenMiktar:0,OdenenTutar:0},1)).toBe(3333);
    expect(itemDueCents({...line,Ikram:true,SatirTutari:0,OdenenMiktar:0,OdenenTutar:0},2)).toBe(0);
  });
});

describe('product options and quick notes',()=>{
  it('requires mandatory groups and swaps single choices',()=>{
    expect(optionProblem(groups,[])).toContain('Şeker');
    const first=toggleOption(groups,[],11);
    expect(toggleOption(groups,first,12)).toEqual([12]);
    expect(toggleOption(groups,[11,21],22)).toEqual([11,21,22]);
    expect(optionProblem(groups,[12,21,22])).toBeNull();
  });
  it('adds and removes quick notes without losing typed text',()=>{
    expect(toggleQuickNote('az tuzlu','Soğansız')).toBe('az tuzlu, Soğansız');
    expect(toggleQuickNote('az tuzlu, Soğansız','soğansız')).toBe('az tuzlu');
  });
});

describe('new staff pages',()=>{
  it('keeps receipts, stock and staff for managers only',()=>{
    for(const page of ['adisyonlar','stok','personel'] as const){
      expect(pageFromPath(`/app/${page}`)).toBe(page);
      expect(canAccess(page,'Admin')).toBe(true);
      expect(canAccess(page,'Garson')).toBe(false);
      expect(canAccess(page,'Mutfak')).toBe(false);
    }
  });
});
