import {lazy, Suspense, useCallback, useEffect, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {HubConnectionBuilder, LogLevel} from '@microsoft/signalr';
import {
  Armchair,
  ChefHat,
  BookOpen,
  ChartNoAxesCombined,
  CalendarDays,
  LogOut,
  RefreshCw,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import type {Health, Session} from './types';
import {api, setToken} from './api';
import {Loading, ThemeToggle} from './ui';
import {LoginPage} from './LoginPage';
import {Tables} from './Tables';
import {MenuPage} from './MenuPage';
import {Kitchen} from './Kitchen';
import './workspace.css';

const Management = lazy(() => import('./Management'));
export type Page = 'masalar' | 'mutfak' | 'menu' | 'raporlar' | 'rezervasyonlar';

interface NavItem {
  id: Page;
  label: string;
  icon: typeof Armchair;
  allowed: boolean;
}

export default function App() {
  const publicMenu = location.pathname === '/menu';
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<Page>('masalar');
  const [currentTime, setCurrentTime] = useState(getFormattedTime());
  const client = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setSession(null);
    client.clear();
  }, [client]);

  useEffect(() => {
    window.addEventListener('auth-expired', logout);
    return () => window.removeEventListener('auth-expired', logout);
  }, [logout]);

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    retry: false
  });

  if (publicMenu) {
    return (
      <div className="public-menu-shell">
        <header className="public-header">
          <div className="public-brand" aria-label="ATIA Restorant">
            <span className="brand-primary">ATIA</span>
            <span className="brand-secondary">Restorant</span>
            <span className="brand-badge">Menü</span>
          </div>
          <div className="public-header-actions">
            <ThemeToggle/>
            <a href="/" className="public-staff-btn">
              <span>Personel Girişi</span>
              <ArrowUpRight size={14}/>
            </a>
          </div>
        </header>

        <main className="public-main">
          <div className="public-intro">
            <h1>Menü</h1>
            <p>Servise hazır ürünler ve güncel fiyat listesi.</p>
          </div>
          <MenuPage publicView/>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        health={health.data}
        healthError={health.error}
        retry={() => void health.refetch()}
        onLogin={s => {
          setToken(s.Token);
          setSession(s);
          setPage(s.Rol === 'Mutfak' ? 'mutfak' : 'masalar');
          client.clear();
        }}
      />
    );
  }

  const nav: NavItem[] = [
    {id: 'masalar', label: 'Masalar', icon: Armchair, allowed: session.Rol !== 'Mutfak'},
    {id: 'mutfak', label: 'Mutfak', icon: ChefHat, allowed: session.Rol !== 'Garson'},
    {id: 'menu', label: 'Menü', icon: BookOpen, allowed: true},
    {id: 'raporlar', label: 'Raporlar', icon: ChartNoAxesCombined, allowed: session.Rol === 'Admin'},
    {id: 'rezervasyonlar', label: 'Rezervasyonlar', icon: CalendarDays, allowed: session.Rol === 'Admin'}
  ];

  const allowedNav = nav.filter(n => n.allowed);

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <div className="workspace-left">
            <div className="workspace-brand" aria-label="ATIA Restorant">
              <span className="brand-name">ATIA</span>
              <span className="brand-sub">Restorant</span>
            </div>

            <nav aria-label="Ana operasyon menüsü" className="workspace-nav">
              {allowedNav.map(n => {
                const Icon = n.icon;
                const active = page === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    className={`workspace-nav-btn ${active ? 'active' : ''}`}
                    onClick={() => setPage(n.id)}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.7}/>
                    <span>{n.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="workspace-right">
            <div className="workspace-clock" title="Sistem saati">
              <Clock size={13}/>
              <span>{currentTime}</span>
            </div>

            <Realtime token={session.Token}/>

            <ThemeToggle/>

            <button
              type="button"
              className="workspace-icon-btn"
              aria-label="Verileri yenile"
              title="Ekrandaki verileri yenile"
              onClick={() => void client.invalidateQueries()}
            >
              <RefreshCw size={15}/>
            </button>

            <a
              href="/menu"
              target="_blank"
              rel="noreferrer"
              className="workspace-qr-btn"
              title="Müşteri QR menüsünü yeni sekmede aç"
            >
              <span>QR Menü</span>
              <ArrowUpRight size={13}/>
            </a>

            <div className="workspace-user">
              <div className="user-meta">
                <span className="user-name">{session.TamAd}</span>
                <span className="user-role">{session.Rol === 'Admin' ? 'Yönetici' : session.Rol}</span>
              </div>
              <button
                type="button"
                className="workspace-logout-btn"
                onClick={logout}
                aria-label="Oturumu kapat"
                title="Çıkış yap"
              >
                <LogOut size={15}/>
                <span className="logout-text">Çıkış</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile secondary navigation strip */}
        <nav aria-label="Mobil operasyon menüsü" className="workspace-mobile-nav">
          {allowedNav.map(n => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button
                key={n.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className={`workspace-mobile-nav-btn ${active ? 'active' : ''}`}
                onClick={() => setPage(n.id)}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.7}/>
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {health.data?.Mode === 'Demo' && (
        <aside className="workspace-demo-notice" role="status">
          <span className="demo-dot" aria-hidden="true"/>
          <span><strong>Demo ortamı:</strong> Örnek verilerle çalışıyorsunuz. Sistem yeniden başladığında sıfırlanır.</span>
        </aside>
      )}

      <main className="workspace-main" id="workspace-content">
        <Suspense fallback={<Loading/>}>
          {page === 'masalar' ? (
            <Tables session={session}/>
          ) : page === 'mutfak' ? (
            <Kitchen/>
          ) : page === 'menu' ? (
            <MenuPage/>
          ) : (
            <Management page={page}/>
          )}
        </Suspense>
      </main>
    </div>
  );
}

function Realtime({token}: {token: string}) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stopped = false;
    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/restorant', {accessTokenFactory: () => token})
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const invalidate = () => void client.invalidateQueries();
    hub.on('Changes', invalidate);
    hub.onreconnecting(() => setConnected(false));
    hub.onreconnected(() => {
      setConnected(true);
      invalidate();
    });
    hub.onclose(() => setConnected(false));

    async function connect() {
      try {
        await hub.start();
        if (!stopped) {
          setConnected(true);
          invalidate();
        }
      } catch {
        if (!stopped) setConnected(false);
      }
    }

    void connect();
    const interval = setInterval(() => {
      if (hub.state === 'Disconnected') void connect();
    }, 15000);

    return () => {
      stopped = true;
      clearInterval(interval);
      void hub.stop();
    };
  }, [token, client]);

  return (
    <div
      className={`workspace-status-pill ${connected ? 'live' : 'connecting'}`}
      role="status"
      title={connected ? 'Canlı SignalR anlık bağlantısı aktif' : 'Bağlantı kuruluyor; veriler otomatik yenilenir'}
    >
      <span className="status-dot" aria-hidden="true"/>
      <span>{connected ? 'Canlı' : 'Bağlanıyor'}</span>
    </div>
  );
}

function getFormattedTime() {
  return new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
}
