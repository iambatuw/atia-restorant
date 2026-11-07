export type Page='genel-bakis'|'masalar'|'paket-servis'|'mutfak'|'menu'|'raporlar'|'rezervasyonlar'|'entegrasyonlar';
export type Role='Admin'|'Garson'|'Mutfak';

export function pageFromPath(path:string):Page|null {
  const match=/^\/app\/(genel-bakis|masalar|paket-servis|mutfak|menu|raporlar|rezervasyonlar|entegrasyonlar)\/?$/.exec(path);
  return match ? match[1] as Page : null;
}
export function defaultPage(role:Role):Page { return role==='Mutfak'?'mutfak':role==='Admin'?'genel-bakis':'masalar'; }
export function canAccess(page:Page,role:Role):boolean {
  return page==='menu'||((page==='masalar'||page==='paket-servis')&&role!=='Mutfak')||(page==='mutfak'&&role!=='Garson')||((page==='genel-bakis'||page==='raporlar'||page==='rezervasyonlar'||page==='entegrasyonlar')&&role==='Admin');
}
export function pagePath(page:Page):string { return `/app/${page}`; }
