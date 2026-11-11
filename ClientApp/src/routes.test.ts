import {describe,expect,it} from 'vitest';
import {canAccess,defaultPage,pageFromPath,pagePath,tablePath,tableRouteFromPath} from './routes';

describe('staff routes',()=>{
  it('distinguishes the public menu from staff pages',()=>{
    expect(pageFromPath('/menu')).toBeNull();
    expect(pageFromPath('/app/menu/')).toBe('menu');
    expect(pageFromPath('/login')).toBeNull();
    expect(pagePath('masalar')).toBe('/app/masalar');
  });
  it('enforces role access to direct links',()=>{
    expect(canAccess('raporlar','Garson')).toBe(false);
    expect(canAccess('masalar','Mutfak')).toBe(false);
    expect(canAccess('mutfak','Admin')).toBe(true);
    expect(defaultPage('Mutfak')).toBe('mutfak');
    expect(defaultPage('Garson')).toBe('masalar');
    expect(defaultPage('Admin')).toBe('genel-bakis');
    expect(canAccess('entegrasyonlar','Admin')).toBe(true);
    expect(canAccess('entegrasyonlar','Garson')).toBe(false);
    expect(canAccess('paket-servis','Garson')).toBe(true);
    expect(canAccess('paket-servis','Mutfak')).toBe(false);
    expect(pageFromPath('/app/rezervasyonlar')).toBe('rezervasyonlar');
  });
  it('keeps older product-picker links valid while opening the picker over a table',()=>{
    expect(tablePath(12)).toBe('/app/masalar/12');
    expect(tablePath(12,true)).toBe('/app/masalar/12/urun-ekle');
    expect(tableRouteFromPath('/app/masalar/12/urun-ekle/')).toEqual({tableId:12,picker:true});
    expect(pageFromPath('/app/masalar/12/urun-ekle')).toBe('masalar');
    expect(tableRouteFromPath('/app/masalar/0/urun-ekle')).toBeNull();
  });
});
