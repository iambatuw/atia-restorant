const KEY='restorant_session';

export function readSessionToken():string|null {
  try {
    const value=JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as unknown;
    if (typeof value==='object' && value!==null && 'token' in value && typeof value.token==='string' && value.token.length>0) return value.token;
    sessionStorage.removeItem(KEY);
  } catch { /* Storage may be unavailable or malformed. */ }
  return null;
}

export function saveSessionToken(token:string):void {
  try { sessionStorage.setItem(KEY,JSON.stringify({token})); } catch { /* Continue without reload persistence. */ }
}

export function clearSessionToken():void {
  try { sessionStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}
