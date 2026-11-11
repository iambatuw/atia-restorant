export type Page='genel-bakis'|'masalar'|'paket-servis'|'mutfak'|'menu'|'raporlar'|'rezervasyonlar'|'entegrasyonlar';
export type Role='Admin'|'Garson'|'Mutfak';

export function pageFromPath(path:string):Page|null {
  if (tableRouteFromPath(path)) return 'masalar';
  const match=/^\/app\/(genel-bakis|masalar|paket-servis|mutfak|menu|raporlar|rezervasyonlar|entegrasyonlar)\/?$/.exec(path);
  return match ? match[1] as Page : null;
}
export function tableRouteFromPath(path:string):{tableId:number;picker:boolean}|null {
  const match=/^\/app\/masalar\/([1-9]\d*)(\/urun-ekle)?\/?$/.exec(path);
  if (!match) return null;
  const tableId=Number(match[1]);
  return Number.isSafeInteger(tableId) ? {tableId,picker:!!match[2]} : null;
}
export function tablePath(tableId:number,picker=false):string {
  return `/app/masalar/${tableId}${picker?'/urun-ekle':''}`;
}
export function defaultPage(role:Role):Page { return role==='Mutfak'?'mutfak':role==='Admin'?'genel-bakis':'masalar'; }
export function canAccess(page:Page,role:Role):boolean {
  return page==='menu'||((page==='masalar'||page==='paket-servis')&&role!=='Mutfak')||(page==='mutfak'&&role!=='Garson')||((page==='genel-bakis'||page==='raporlar'||page==='rezervasyonlar'||page==='entegrasyonlar')&&role==='Admin');
}
export function pagePath(page:Page):string { return `/app/${page}`; }
