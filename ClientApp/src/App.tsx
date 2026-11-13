import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {HubConnectionBuilder,LogLevel} from '@microsoft/signalr';
import {
  Armchair,
  ChefHat,
  BookOpen,
  ChartNoAxesCombined,
  LayoutDashboard,
  PlugZap,
  CalendarDays,
  MoreHorizontal,
  Truck,
  LogOut,
  RefreshCw,
  ArrowUpRight,
  Clock,
  Settings2,
  ReceiptText,
  Boxes,
  UsersRound,
  Landmark,
  ShoppingBag,
  ChevronDown
} from 'lucide-react';
import type {Health,Session} from './types';
import {api,ApiError,setToken} from './api';
import {clearSessionToken,readSessionToken,saveSessionToken} from './session';
import {Empty,Loading,ThemeToggle} from './ui';
import {LoginPage} from './LoginPage';
import {GuestCallsBar,GuestTableBar} from './GuestFeatures';
import {Tables} from './Tables';
import {MenuPage} from './MenuPage';
import {Kitchen} from './Kitchen';
import {Overview} from './Overview';
import {Integrations} from './Integrations';
import {DeliveryPage} from './DeliveryPage';
import {SettingsPage} from './SettingsPage';
import './Operations.css';
import {canAccess,defaultPage,pageFromPath,pagePath} from './routes';
import type {Page} from './routes';

const Management=lazy(()=>import('./Management'));
const ReceiptsPage=lazy(()=>import('./ReceiptsPage'));
const StockPage=lazy(()=>import('./StockPage'));
const StaffPage=lazy(()=>import('./StaffPage'));
const CashPage=lazy(()=>import('./CashPage'));
const QuickSalePage=lazy(()=>import('./QuickSalePage'));
export default function App(){
  const [path,setPath]=useState(()=>location.pathname);
  const publicMenu=path.replace(/\/$/,'')==='/menu';
  const [guestCode]=useState(()=>{const code=new URLSearchParams(location.search).get('masa');return code&&/^[0-9a-f]{16}$/.test(code)?code:null;});
  const navigate=useCallback((next:string,replace=false)=>{
    if(location.pathname!==next) window.history[replace?'replaceState':'pushState'](null,'',next);
    setPath(next);
  },[]);
  useEffect(()=>{
    const onPop=()=>setPath(location.pathname);
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);
  const [session,setSession]=useState<Session|null>(null);
  const [candidate] = useState(()=>publicMenu ? null : readSessionToken());
  const [restoring,setRestoring]=useState(!!candidate);
  const [restoreError,setRestoreError]=useState(false);
  const [retryRestore,setRetryRestore]=useState(0);
  const generation=useRef(0);
  const [currentTime,setCurrentTime]=useState(getFormattedTime());
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [openNavGroup,setOpenNavGroup]=useState<string|null>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  const mobileMenuRef=useRef<HTMLElement>(null);
  const moreButtonRef=useRef<HTMLButtonElement>(null);
  const client=useQueryClient();

  useEffect(()=>{
    if(!openNavGroup&&!mobileMenuOpen)return;
    const onOutside=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(sidebarRef.current?.contains(target)||mobileMenuRef.current?.contains(target)||moreButtonRef.current?.contains(target))return;
      setOpenNavGroup(null);
      setMobileMenuOpen(false);
    };
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setOpenNavGroup(null);setMobileMenuOpen(false);}
    };
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onEscape);
    return()=>{document.removeEventListener('pointerdown',onOutside);document.removeEventListener('keydown',onEscape);};
  },[openNavGroup,mobileMenuOpen]);

  useEffect(()=>{
    const timer=setInterval(()=>setCurrentTime(getFormattedTime()),1000);
    return ()=>clearInterval(timer);
  },[]);

  const logout=useCallback(()=>{
    generation.current++;
    setToken('');
    clearSessionToken();
    setSession(null);
    setRestoring(false);
    setRestoreError(false);
    setMobileMenuOpen(false);
    setOpenNavGroup(null);
    client.clear();
    navigate('/login',true);
  },[client,navigate]);

  useEffect(()=>{
    window.addEventListener('auth-expired',logout);
    return()=>window.removeEventListener('auth-expired',logout);
  },[logout]);

  useEffect(()=>{
    if (!candidate || !restoring) return;
    let cancelled=false;
    const current=++generation.current;
    setToken(candidate);
    setRestoreError(false);
    api<Pick<Session,'KullaniciId'|'TamAd'|'Rol'>>('/auth/session').then(identity=>{
      if (cancelled || generation.current!==current) return;
      if (!identity || !['Admin','Garson','Mutfak'].includes(identity.Rol) || !identity.TamAd || !identity.KullaniciId) throw new Error('Oturum bilgisi geçersiz.');
      setSession({...identity,Token:candidate,KullaniciAdi:''});
      setRestoring(false);
    }).catch(error=>{
      if (cancelled || generation.current!==current) return;
      if (error instanceof ApiError && (error.status===401 || error.status===403)) logout();
      else setRestoreError(true);
    });
    return ()=>{cancelled=true;};
  },[candidate,retryRestore,restoring,logout]);

  const health=useQuery({
    queryKey:['health'],
    queryFn:()=>api<Health>('/health'),
    retry:false
  });

  const requested=pageFromPath(path);
  useEffect(()=>{
    if(publicMenu||restoring) return;
    if(!session){
      if(path==='/') navigate('/login',true);
      return;
    }
    if(!requested||!canAccess(requested,session.Rol)) navigate(pagePath(defaultPage(session.Rol)),true);
  },[publicMenu,restoring,session,requested,path,navigate]);

  if(publicMenu) {
    return (
      <div className="public-menu-shell">
        <header className="customer-head">
          <Brand isPublic/>
          <div className="customer-head-actions">
            <ThemeToggle/>
            <a href="/login" className="staff-portal-btn">
              <span>Personel Girişi</span>
              <ArrowUpRight size={15}/>
            </a>
          </div>
        </header>

        {guestCode&&<GuestTableBar code={guestCode}/>}
        <MenuPage publicView/>
      </div>
    );
  }

  if (restoring) {
    return restoreError ? <div className="empty" role="alert"><p>Oturum doğrulanamadı. Bağlantınızı kontrol edin.</p><button className="primary" onClick={()=>setRetryRestore(n=>n+1)}>Yeniden dene</button><button className="secondary" onClick={logout}>Çıkış yap</button></div> : <Loading/>;
  }

  if(!session) {
    return (
      <LoginPage
        health={health.data}
        healthError={health.error}
        retry={()=>void health.refetch()}
        onLogin={s=>{
          generation.current++;
          saveSessionToken(s.Token);
          setToken(s.Token);
          setSession(s);
          navigate(pagePath(requested&&canAccess(requested,s.Rol)?requested:defaultPage(s.Rol)),true);
          client.clear();
        }}
      />
    );
  }

  const nav=[
    {id:'genel-bakis',group:'Operasyon',label:'Genel bakış',icon:LayoutDashboard,allowed:session.Rol==='Admin'},
    {id:'masalar',group:'Operasyon',label:'Masalar',icon:Armchair,allowed:session.Rol!=='Mutfak'},
    {id:'paket-servis',group:'Operasyon',label:'Paket servis',icon:Truck,allowed:session.Rol!=='Mutfak'},
    {id:'hizli-satis',group:'Operasyon',label:'Hızlı satış',icon:ShoppingBag,allowed:session.Rol==='Admin'},
    {id:'mutfak',group:'Operasyon',label:'Mutfak',icon:ChefHat,allowed:session.Rol!=='Garson'},
    {id:'menu',group:'Operasyon',label:'Menü',icon:BookOpen,allowed:true},
    {id:'raporlar',group:'Yönetim',label:'Raporlar',icon:ChartNoAxesCombined,allowed:session.Rol==='Admin'},
    {id:'adisyonlar',group:'Yönetim',label:'Adisyonlar',icon:ReceiptText,allowed:session.Rol==='Admin'},
    {id:'kasa',group:'Yönetim',label:'Kasa ve cari',icon:Landmark,allowed:session.Rol==='Admin'},
    {id:'stok',group:'Yönetim',label:'Stok ve maliyet',icon:Boxes,allowed:session.Rol==='Admin'},
    {id:'personel',group:'Yönetim',label:'Personel',icon:UsersRound,allowed:session.Rol==='Admin'},
    {id:'entegrasyonlar',group:'Sistem',label:'Entegrasyonlar',icon:PlugZap,allowed:session.Rol==='Admin'},
    {id:'rezervasyonlar',group:'Sistem',label:'Rezervasyonlar',icon:CalendarDays,allowed:session.Rol==='Admin'},
    {id:'ayarlar',group:'Sistem',label:'Ayarlar',icon:Settings2,allowed:session.Rol==='Admin'}
  ];
  const page:Page=requested&&canAccess(requested,session.Rol)?requested:defaultPage(session.Rol);
  const current=nav.find(n=>n.id===page)!;
  const visibleNav=nav.filter(item=>item.allowed);
  const navGroups=[{label:'Operasyon',icon:LayoutDashboard},{label:'Yönetim',icon:ChartNoAxesCombined},{label:'Sistem',icon:Settings2}];
  const groupedLinks=(mobile:boolean)=>navGroups.map(group=>{
    const links=visibleNav.filter(item=>item.group===group.label);
    if(!links.length)return null;
    const expanded=openNavGroup===group.label;
    const panelId=`${mobile?'mobile':'desktop'}-${group.label.toLocaleLowerCase('tr')}`;
    return <section className="op-nav-section" key={group.label}>
      <button type="button" className="op-nav-group-trigger" aria-expanded={expanded} aria-controls={panelId}
        aria-label={`${group.label} menüsü`} title={group.label}
        onClick={()=>setOpenNavGroup(currentGroup=>currentGroup===group.label?null:group.label)}>
        <group.icon size={19}/><span>{group.label}</span><ChevronDown className="op-nav-chevron" size={17}/>
      </button>
      {expanded&&<div id={panelId} className="op-nav-children">{links.map(item=><a key={item.id} href={pagePath(item.id as Page)}
        aria-current={page===item.id?'page':undefined} className={`op-nav-item ${page===item.id?'active':''}`}
        title={item.label} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
          event.preventDefault();setOpenNavGroup(null);setMobileMenuOpen(false);navigate(pagePath(item.id as Page));
        }}}><item.icon size={19}/><span>{item.label}</span></a>)}</div>}
    </section>;
  });

  return (
    <div className="op-app">
      <aside className="op-sidebar" ref={sidebarRef}>
        <div className="op-brand"><strong>ATIA</strong><span>Restoran</span></div>
        <nav aria-label="Ana menü" className="op-nav">
          {groupedLinks(false)}
        </nav>
        <nav className="op-mobile-bottom-nav" aria-label="Hızlı ekranlar">{visibleNav.slice(0,4).map(item=><a key={item.id}
          href={pagePath(item.id as Page)} aria-current={page===item.id?'page':undefined} onClick={event=>{
            if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();setOpenNavGroup(null);setMobileMenuOpen(false);navigate(pagePath(item.id as Page));}
          }}><item.icon size={19}/><span>{item.label}</span></a>)}</nav>
        <div className="op-sidebar-bottom">
          <a className="op-public-link" href="/menu" target="_blank" rel="noreferrer"><BookOpen size={17}/> Müşteri menüsü <ArrowUpRight size={15}/></a>
          <div className="op-user"><span className="op-avatar">{session.TamAd.slice(0,1)}</span><div><strong>{session.TamAd}</strong><small>{session.Rol==='Admin'?'Yönetici':session.Rol}</small></div><button onClick={logout} aria-label="Oturumu kapat" title="Çıkış yap"><LogOut size={17}/></button></div>
        </div>
      </aside>

      <div className="op-workspace">
        <header className="op-topbar">
          <div className="op-location"><span>ATIA / Operasyon</span><strong>{current.label}</strong></div>
          <div className="op-topbar-tools">
            <span className="op-clock"><Clock size={15}/>{currentTime}</span>
            <Realtime token={session.Token}/>
            <ThemeToggle/>
            <button ref={moreButtonRef} className="icon-button op-more-button" aria-label="Tüm ekranlar" aria-expanded={mobileMenuOpen} onClick={()=>{setOpenNavGroup(null);setMobileMenuOpen(open=>!open);}}><MoreHorizontal size={19}/></button>
            <button
              className="icon-button"
              aria-label="Verileri yenile"
              title="Ekranı yenile"
              onClick={()=>void client.invalidateQueries()}
            >
              <RefreshCw size={17}/>
            </button>
            <button
              className="icon-button op-mobile-logout"
              aria-label="Oturumu kapat"
              onClick={logout}
            >
              <LogOut size={17}/>
            </button>
          </div>
        </header>
        {mobileMenuOpen&&<nav ref={mobileMenuRef} className="op-mobile-menu" aria-label="Tüm ekranlar menüsü">{groupedLinks(true)}</nav>}

        {health.data?.Mode==='Demo'&&(
          <div className="op-demo-notice" role="status">
            <strong>Demo veri</strong><span>{health.data.KaliciDemo?'Gerçek veritabanına bağlı değil. Kayıtlar yalnızca bu sunucudaki demo dosyasında saklanır.':'İşlemler sunucu yeniden başlatıldığında sıfırlanır.'}</span>
          </div>
        )}

        <main className="op-main" id="ana-icerik">
          {session.Rol!=='Mutfak'&&<GuestCallsBar/>}
          <Suspense fallback={<Loading/>}>
            {page==='genel-bakis'?(
              <Overview navigate={p=>navigate(pagePath(p))}/>
            ):page==='masalar'?(
              <Tables session={session} path={path} navigate={navigate}/>
            ):page==='paket-servis'?(
              <DeliveryPage admin={session.Rol==='Admin'}/>
            ):page==='mutfak'?(
              <Kitchen/>
            ):page==='menu'?(
              <MenuPage admin={session.Rol==='Admin'}/>
            ):page==='entegrasyonlar'?(
              <Integrations navigate={p=>navigate(pagePath(p))}/>
            ):page==='ayarlar'?(
              <SettingsPage/>
            ):page==='adisyonlar'?(
              <ReceiptsPage/>
            ):page==='kasa'?(
              <CashPage/>
            ):page==='hizli-satis'?(
              <QuickSalePage/>
            ):page==='stok'?(
              <StockPage/>
            ):page==='personel'?(
              <StaffPage session={session}/>
            ):(
              <Management page={page as 'raporlar'|'rezervasyonlar'}/>
            )}
          </Suspense>
        </main>

      </div>
    </div>
  );
}

function Brand({isPublic=false}:{isPublic?:boolean}){
  return (
    <div className={`brand-wrapper ${isPublic?'public':''}`}>
      <div className="brand-text-block">
        <span className="brand-primary">ATIA</span>
        <span className="brand-secondary">Restoran</span>
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
      title={connected?'Canlı bağlantı açık':'Bağlantı yeniden kurulmaya çalışılıyor'}
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
