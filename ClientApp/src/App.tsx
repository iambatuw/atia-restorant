import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {HubConnectionBuilder,LogLevel} from '@microsoft/signalr';
import {
  Armchair,
  ChefHat,
  BookOpen,
  ChartNoAxesCombined,
  CalendarDays,
  LogOut,
  RefreshCw,
  ArrowUpRight,
  UtensilsCrossed,
  Clock
} from 'lucide-react';
import type {Health,Session} from './types';
import {api,setToken} from './api';
import {Empty,Loading,ThemeToggle} from './ui';
import {LoginPage} from './LoginPage';
import {Tables} from './Tables';
import {MenuPage} from './MenuPage';
import {Kitchen} from './Kitchen';

const Management=lazy(()=>import('./Management'));
type Page='masalar'|'mutfak'|'menu'|'raporlar'|'rezervasyonlar';

export default function App(){
  const publicMenu=location.pathname==='/menu';
  const [session,setSession]=useState<Session|null>(null);
  const [page,setPage]=useState<Page>('masalar');
  const [currentTime,setCurrentTime]=useState(getFormattedTime());
  const client=useQueryClient();

  useEffect(()=>{
    const timer=setInterval(()=>setCurrentTime(getFormattedTime()),1000);
    return ()=>clearInterval(timer);
  },[]);

  const logout=useCallback(()=>{
    setToken('');
    setSession(null);
    client.clear();
  },[client]);

  useEffect(()=>{
    window.addEventListener('auth-expired',logout);
    return()=>window.removeEventListener('auth-expired',logout);
  },[logout]);

  const health=useQuery({
    queryKey:['health'],
    queryFn:()=>api<Health>('/health'),
    retry:false
  });

  if(publicMenu) {
    return (
      <div className="public-menu-shell">
        <header className="customer-head">
          <Brand isPublic/>
          <div className="customer-head-actions">
            <ThemeToggle/>
            <a href="/" className="staff-portal-btn">
              <span>Personel Girişi</span>
              <ArrowUpRight size={15}/>
            </a>
          </div>
        </header>

        <div className="customer-hero">
          <h1>Menü</h1>
          <p>Güncel ürünleri ve fiyatları inceleyin.</p>
        </div>

        <MenuPage publicView/>
      </div>
    );
  }

  if(!session) {
    return (
      <LoginPage
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
    {id:'masalar',label:'Masa Planı',icon:Armchair,allowed:session.Rol!=='Mutfak'},
    {id:'mutfak',label:'Mutfak (KDS)',icon:ChefHat,allowed:session.Rol!=='Garson'},
    {id:'menu',label:'Menü Kataloğu',icon:BookOpen,allowed:true},
    {id:'raporlar',label:'Günlük Rapor',icon:ChartNoAxesCombined,allowed:session.Rol==='Admin'},
    {id:'rezervasyonlar',label:'Rezervasyonlar',icon:CalendarDays,allowed:session.Rol==='Admin'}
  ];
  const current=nav.find(n=>n.id===page)!;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand/>
        <div className="sidebar-section-divider">
          <span>OPERASYON MENÜSÜ</span>
        </div>

        <nav aria-label="Ana menü" className="sidebar-nav">
          {nav.filter(n=>n.allowed).map(n=>(
            <button
              key={n.id}
              aria-current={page===n.id?'page':undefined}
              className={`nav-item ${page===n.id?'active':''}`}
              onClick={()=>setPage(n.id as Page)}
            >
              <n.icon size={19} className="nav-icon"/>
              <span className="nav-label">{n.label}</span>
              {page===n.id&&<span className="active-glow-indicator" aria-hidden="true"/>}
            </button>
          ))}
        </nav>

        <a className="qr-menu-callout" href="/menu" target="_blank" rel="noreferrer">
          <div className="callout-icon">
            <BookOpen size={18}/>
          </div>
          <div className="callout-text">
            <strong>Müşteri Menüsü</strong>
            <small>QR Katalog Önizleme</small>
          </div>
          <ArrowUpRight size={15} className="callout-arrow"/>
        </a>

        <div className="sidebar-bottom">
          <div className="user-profile-badge">
            <div className="avatar-monogram">{session.TamAd.slice(0,1)}</div>
            <div className="user-details">
              <strong>{session.TamAd}</strong>
              <span className="role-tag">{session.Rol==='Admin'?'Yönetici':session.Rol}</span>
            </div>
            <button
              onClick={logout}
              aria-label="Oturumu kapat"
              title="Çıkış yap"
              className="logout-action-btn"
            >
              <LogOut size={17}/>
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="bread-root">Atia Operasyon</span>
            <span className="bread-sep">/</span>
            <strong className="bread-current">{current.label}</strong>
          </div>

          <div className="topbar-tools">
            <div className="topbar-clock" title="Sistem Saati">
              <Clock size={14}/>
              <span>{currentTime}</span>
            </div>
            <Realtime token={session.Token}/>
            <ThemeToggle/>
            <button
              className="icon-button"
              aria-label="Verileri yenile"
              title="Ekranı yenile"
              onClick={()=>void client.invalidateQueries()}
            >
              <RefreshCw size={17}/>
            </button>
            <button
              className="icon-button mobile-logout"
              aria-label="Oturumu kapat"
              onClick={logout}
            >
              <LogOut size={17}/>
            </button>
          </div>
        </header>

        {health.data?.Mode==='Demo'&&(
          <div className="demo-notice-bar">
            <span className="demo-dot"/>
            <span><strong>Demo Modu Aktif:</strong> Örnek restoran verileriyle çalışıyorsunuz. Değişiklikler sunucu yeniden başlatılınca sıfırlanır.</span>
          </div>
        )}

        <main className="main-viewport">
          <Suspense fallback={<Loading/>}>
            {page==='masalar'?(
              <Tables session={session}/>
            ):page==='mutfak'?(
              <Kitchen/>
            ):page==='menu'?(
              <MenuPage/>
            ):(
              <Management page={page}/>
            )}
          </Suspense>
        </main>

        <footer className="app-footer">
          <div className="footer-left">
            <span className="brand-sub">ATİA POS RESTORAN SİSTEMİ</span>
            <span className="footer-dot">•</span>
            <span>.NET 10 LTS &amp; React 19</span>
          </div>
          <div className="footer-right">
            <span>Server-Authoritative Financial Engine</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Brand({isPublic=false}:{isPublic?:boolean}){
  return (
    <div className={`brand-wrapper ${isPublic?'public':''}`}>
      <div className="brand-crest" aria-hidden="true">
        <span className="crest-monogram">A</span>
        <UtensilsCrossed size={12} className="crest-sub-icon"/>
      </div>
      <div className="brand-text-block">
        <span className="brand-primary">ATİA</span>
        <span className="brand-secondary">{isPublic?'BİSTRO &amp; GOURMET':'RESTORAN &amp; POS'}</span>
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
      className={`connection-pill ${connected?'live':'offline'}`}
      title={connected?'Canlı SignalR bağlantısı aktif':'Bağlantı kuruluyor; veriler 15 saniyede yenilenir'}
    >
      <span className="live-dot" aria-hidden="true"/>
      <span>{connected?'Canlı':'Bağlanıyor'}</span>
    </span>
  );
}

function getFormattedTime(){
  const d=new Date();
  return d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
}

export {Empty};
