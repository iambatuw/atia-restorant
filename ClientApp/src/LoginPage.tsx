import {useState} from 'react';
import {ArrowUpRight, ChefHat, ClipboardList, Wifi, UserCheck} from 'lucide-react';
import type {Health, Session} from './types';
import {login} from './api';
import {ErrorBox, ThemeToggle} from './ui';

interface LoginPageProps {
  health?: Health;
  healthError: unknown;
  retry: () => void;
  onLogin: (s: Session) => void;
}

export function LoginPage({health, healthError, retry, onLogin}: LoginPageProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fillDemo = (u: string) => {
    setName(u);
    setPassword('demo123');
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await login(name, password));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const isDemo = health?.Mode === 'Demo';
  const dbReady = health?.DatabaseReady ?? false;
  const canSubmit = !busy && !!name && !!password && (health != null);

  return (
    <div className="login-stage">
      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-brand-block">
          <div className="login-brand-mark">
            <div className="login-brand-crest" aria-hidden="true">A</div>
            <div>
              <div className="login-brand-name">ATİA</div>
              <div className="login-brand-sub">Restoran &amp; POS Sistemi</div>
            </div>
          </div>

          <h1 className="login-hero-headline">
            Restoranınızı<br/>
            <em>tek merkezden</em><br/>
            yönetin.
          </h1>
          <p className="login-tagline">
            Masa planı, mutfak ekranı ve günlük raporlar — hepsi
            canlı veri ile, tek bir panelden.
          </p>
        </div>

        <ul className="login-feature-list login-features">
          <li className="login-feature-item">
            <span className="login-feature-dot" aria-hidden="true"/>
            <ClipboardList size={16} style={{flexShrink: 0, opacity: .7}}/>
            Gerçek zamanlı masa ve sipariş takibi
          </li>
          <li className="login-feature-item">
            <span className="login-feature-dot" aria-hidden="true"/>
            <ChefHat size={16} style={{flexShrink: 0, opacity: .7}}/>
            Mutfak ekranı (KDS) ile bilet yönetimi
          </li>
          <li className="login-feature-item">
            <span className="login-feature-dot" aria-hidden="true"/>
            <Wifi size={16} style={{flexShrink: 0, opacity: .7}}/>
            SignalR ile canlı bildirim ve senkronizasyon
          </li>
        </ul>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-right-topbar">
          <ThemeToggle/>
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <h2>Personel Girişi</h2>
            <p>
              {health == null
                ? 'Sunucuya bağlanılıyor…'
                : isDemo
                  ? 'Demo ortamı aktif. Aşağıdan hızlı giriş yapabilirsiniz.'
                  : dbReady
                    ? 'Operasyon paneline erişmek için giriş yapın.'
                    : 'Veritabanı bağlantısı bekleniyor.'}
            </p>
          </div>

          <ErrorBox error={healthError} retry={retry}/>

          <form onSubmit={submit}>
            <div className="login-fields">
              <div className="login-field">
                <label htmlFor="lp-username">Kullanıcı Adı</label>
                <input
                  id="lp-username"
                  autoFocus
                  autoComplete="username"
                  required
                  placeholder="Kullanıcı adınızı girin"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label htmlFor="lp-password">Şifre</label>
                <input
                  id="lp-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <ErrorBox error={error}/>

            <button
              type="submit"
              className="login-submit"
              disabled={!canSubmit}
            >
              {busy ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  Yetkilendiriliyor…
                </>
              ) : 'Oturum Aç'}
            </button>
          </form>

          {isDemo && (
            <div className="login-demo-section">
              <div className="login-demo-label">
                <UserCheck size={13}/>
                Demo Hesapları — Tıklayarak Doldurun
              </div>
              <div className="login-demo-chips">
                <button
                  type="button"
                  className="login-chip-btn"
                  onClick={() => fillDemo('admin')}
                >
                  <strong>Admin</strong>
                  <small>Yönetici &amp; Rapor</small>
                </button>
                <button
                  type="button"
                  className="login-chip-btn"
                  onClick={() => fillDemo('garson')}
                >
                  <strong>Garson</strong>
                  <small>Masa &amp; Sipariş</small>
                </button>
                <button
                  type="button"
                  className="login-chip-btn"
                  onClick={() => fillDemo('mutfak')}
                >
                  <strong>Mutfak</strong>
                  <small>KDS Ekranı</small>
                </button>
              </div>
            </div>
          )}

          <div className="login-footer">
            <a href="/menu" className="login-menu-link">
              Müşteri Menüsünü Görüntüle
              <ArrowUpRight size={14}/>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
