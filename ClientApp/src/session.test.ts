import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSessionToken,readSessionToken,saveSessionToken} from './session';

afterEach(()=>vi.unstubAllGlobals());
describe('Sekme oturumu',()=>{
  it('tokenı kaydeder, okur ve siler',()=>{
    const values=new Map<string,string>();
    vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
    saveSessionToken('example'); expect(readSessionToken()).toBe('example');
    clearSessionToken(); expect(readSessionToken()).toBeNull();
  });
  it('bozuk veya erişilemeyen depolamada hata fırlatmaz',()=>{
    vi.stubGlobal('sessionStorage',{getItem:()=>'{',removeItem:()=>{}});
    expect(readSessionToken()).toBeNull();
    vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}});
    expect(readSessionToken()).toBeNull(); expect(()=>saveSessionToken('x')).not.toThrow(); expect(()=>clearSessionToken()).not.toThrow();
  });
});
