import {describe,expect,it} from 'vitest';
import {toCsv} from './csv';
import {canAccess,pageFromPath} from './routes';

describe('CSV export',()=>{
  it('writes Excel-friendly Turkish CSV and neutralises formulas',()=>{
    const csv=toCsv(['Ad','Tutar'],[['=HYPERLINK("x")',1234.5],['Köfte; acılı',-20],[null,0]]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines=csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Ad;Tutar');
    expect(lines[1]).toBe('"\'=HYPERLINK(""x"")";1234,5');
    expect(lines[2]).toBe('"Köfte; acılı";-20');
    expect(lines[3]).toBe(';0');
  });
});

describe('till and counter pages',()=>{
  it('are reachable only by managers',()=>{
    for(const page of ['kasa','hizli-satis'] as const){
      expect(pageFromPath(`/app/${page}`)).toBe(page);
      expect(canAccess(page,'Admin')).toBe(true);
      expect(canAccess(page,'Garson')).toBe(false);
    }
  });
});
