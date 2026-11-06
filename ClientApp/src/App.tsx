import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {HubConnectionBuilder,LogLevel} from '@microsoft/signalr';
import {Armchair,ChefHat,BookOpen,ChartNoAxesCombined,CalendarDays,LogOut,RefreshCw,ArrowUpRight,UtensilsCrossed,Wifi,WifiOff} from 'lucide-react';
import type {Health,Session} from './types';
import {api,login,setToken} from './api';
import {Empty,ErrorBox,Loading,ThemeToggle} from './ui';
import {Tables} from './Tables';
import {MenuPage} from './MenuPage';
import {Kitchen} from './Kitchen';
const Management=lazy(()=>import('./Management'));
type Page='masalar'|'mutfak'|'menu'|'raporlar'|'rezervasyonlar';

export default function App(){
 const publicMenu=location.pathname==='/menu';
 const [session,setSession]=useState<Session|null>(null);
 const [page,setPage]=useState<Page>('masalar');
 const client=useQueryClient();
 const logout=useCallback(()=>{setToken('');setSession(null);client.clear();},[client]);
 useEffect(()=>{window.addEventListener('auth-expired',logout);return()=>window.removeEventListener('auth-expired',logout);},[logout]);
 const health=useQuery({queryKey:['health'],queryFn:()=>api<Health>('/health'),retry:false});

 if(publicMenu) {
  return (
   <div className="public-menu">
    <header className="customer-head">
     <Brand/>
     <div className="customer-head-actions">
      <ThemeToggle/>
      <a href="/">Personel girişi <ArrowUpRight size={16}/></a>
     </div>
    </header>
    <div className="customer-title">
     <span className="pill">{health.data?.Mode==='Demo'?'Örnek menü':'Dijital menü'}</span>
     <h1>Restoran Menüsü</h1>
     <p>Güncel ürünler ve porsiyon fiyatları.</p>
    </div>
    <MenuPage publicView/>
   </div>
  );
 }

 if(!session) {
  return (
   <Login
    health={health.data}
    healthError={health.error}
    retry={()=>void health.refetch()}
    onLogin={s=>{
     setToken(s.Token);
     setSession(s);
     setPage(s.Rol==='Mutfak'?'mutfak':'masalar');
     client.clear();
    }}
   />
  );
 }

 const nav=[
  {id:'masalar',label:'Masa planı',icon:Armchair,allowed:session.Rol!=='Mutfak'},
  {id:'mutfak',label:'Mutfak ekranı',icon:ChefHat,allowed:session.Rol!=='Garson'},
  {id:'menu',label:'Menü',icon:BookOpen,allowed:true},
  {id:'raporlar',label:'Günlük rapor',icon:ChartNoAxesCombined,allowed:session.Rol==='Admin'},
  {id:'rezervasyonlar',label:'Rezervasyonlar',icon:CalendarDays,allowed:session.Rol==='Admin'}
 ];
 const current=nav.find(n=>n.id===page)!;

 return (
  <div className="app-shell">
   <aside className="sidebar">
    <Brand/>
    <div className="restaurant-label">Restoran yönetimi</div>
    <nav aria-label="Ana menü">
     {nav.filter(n=>n.allowed).map(n=>(
      <button
       key={n.id}
       aria-current={page===n.id?'page':undefined}
       className={page===n.id?'active':''}
       onClick={()=>setPage(n.id as Page)}
      >
       <n.icon size={20}/>
       <span>{n.label}</span>
      </button>
     ))}
    </nav>
    <a className="qr-link" href="/menu" target="_blank" rel="noreferrer">
     <BookOpen size={19}/>
     <span>Müşteri menüsünü aç</span>
     <ArrowUpRight size={16}/>
    </a>
    <div className="sidebar-bottom">
     <div className="avatar">{session.TamAd.slice(0,1)}</div>
     <div>
      <strong>{session.TamAd}</strong>
      <small>{session.Rol==='Admin'?'Yönetici':session.Rol}</small>
     </div>
     <button onClick={logout} aria-label="Çıkış yap" title="Çıkış yap">
      <LogOut size={19}/>
     </button>
    </div>
   </aside>
   <div className="workspace">
    <header className="topbar">
     <div className="breadcrumb">
      Operasyon <span>/</span> <strong>{current.label}</strong>
     </div>
     <div className="topbar-tools">
      <Realtime token={session.Token}/>
      <ThemeToggle/>
      <button className="icon-button mobile-logout" aria-label="Oturumu kapat" onClick={logout}>
       <LogOut size={18}/>
      </button>
      <button className="icon-button" aria-label="Verileri yenile" onClick={()=>void client.invalidateQueries()}>
       <RefreshCw size={18}/>
      </button>
     </div>
    </header>
    <div className="demo-banner">
     {health.data?.Mode==='Demo'
      ?'Demo çalışma alanı · İşlemler örnek verilerle yapılır, yeniden başlatınca sıfırlanır.'
      :'SQL bağlantısı doğrulanana kadar gerçek veri işlemleri kapalı.'}
    </div>
    <main>
     <Suspense fallback={<Loading/>}>
      {page==='masalar'?<Tables session={session}/>:page==='mutfak'?<Kitchen/>:page==='menu'?<MenuPage/>:<Management page={page}/>}
     </Suspense>
    </main>
    <footer className="app-footer">
     <span>Restoran Yönetim Sistemi</span>
     <span>Operasyon Paneli · .NET 10 LTS</span>
    </footer>
   </div>
  </div>
 );
}

function Brand(){
 return (
  <div className="brand">
   <div className="brand-mark" aria-hidden="true">
    <UtensilsCrossed size={20}/>
   </div>
   <span className="brand-text">Restoran</span>
  </div>
 );
}

function Login({health,healthError,retry,onLogin}:{health?:Health;healthError:unknown;retry:()=>void;onLogin:(s:Session)=>void}){
 const [name,setName]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<unknown>(null);

 async function submit(e:React.FormEvent){
  e.preventDefault();
  setBusy(true);
  setError(null);
  try{
   onLogin(await login(name,password));
  }catch(e){
   setError(e);
  }finally{
   setBusy(false);
  }
 }

 return (
  <div className="login-shell">
   <div className="login-card">
    <div className="login-header">
     <Brand/>
     <ThemeToggle/>
    </div>
    <h2>Personel Girişi</h2>
    <p className="login-subtitle">Restoran operasyon paneline erişmek için giriş yapın.</p>
    <ErrorBox error={healthError} retry={retry}/>
    <form onSubmit={submit}>
     <label>
      Kullanıcı adı
      <input autoFocus autoComplete="username" required value={name} onChange={e=>setName(e.target.value)}/>
     </label>
     <label>
      Şifre
      <input autoComplete="current-password" required type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
     </label>
     <ErrorBox error={error}/>
     <button className="primary full" disabled={busy||!health}>
      {busy?'Giriş yapılıyor…':'Giriş yap'}
     </button>
    </form>
    {health?.Mode==='Demo' ? (
     <div className="demo-accounts">
      <strong>Demo hesapları</strong>
      <p>Yönetici: <code>admin</code> · Garson: <code>garson</code> · Mutfak: <code>mutfak</code></p>
      <p>Şifre: <code>demo123</code></p>
     </div>
    ) : null}
    <a className="text-link login-footer-link" href="/menu">
     Müşteri menüsünü aç <ArrowUpRight size={16}/>
    </a>
   </div>
  </div>
 );
}

function Realtime({token}:{token:string}){
 const client=useQueryClient();
 const [connected,setConnected]=useState(false);

 useEffect(()=>{
  let stopped=false;
  const hub=new HubConnectionBuilder()
   .withUrl('/hubs/restorant',{accessTokenFactory:()=>token})
   .withAutomaticReconnect()
   .configureLogging(LogLevel.Warning)
   .build();

  const invalidate=()=>void client.invalidateQueries();
  hub.on('Changes',invalidate);
  hub.onreconnecting(()=>setConnected(false));
  hub.onreconnected(()=>{
   setConnected(true);
   invalidate();
  });
  hub.onclose(()=>setConnected(false));

  async function connect(){
   try{
    await hub.start();
    if(!stopped){
     setConnected(true);
     invalidate();
    }
   }catch{
    if(!stopped)setConnected(false);
   }
  }

  void connect();
  const interval=setInterval(()=>{
   if(hub.state==='Disconnected')void connect();
  },15000);

  return ()=>{
   stopped=true;
   clearInterval(interval);
   void hub.stop();
  };
 },[token,client]);

 return (
  <span
   className={`connection ${connected?'online':''}`}
   title={connected?'Canlı güncellemeler bağlı':'Canlı bağlantı yok; veriler 15 saniyede yenilenir'}
  >
   {connected?<Wifi size={15}/>:<WifiOff size={15}/>}
   <span>{connected?'Canlı':'Bağlanıyor'}</span>
  </span>
 );
}

export {Empty};
