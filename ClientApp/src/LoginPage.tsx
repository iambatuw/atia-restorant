import {useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {Eye, EyeOff, LockKeyhole} from 'lucide-react';
import type {Health, Session} from './types';
import {login} from './api';
import {ErrorBox, ThemeToggle} from './ui';
import './LoginPage.css';

interface LoginPageProps {
  health?: Health;
  healthError: unknown;
  retry: () => void;
  onLogin: (session: Session) => void;
}

function RestaurantPlan() {
  return (
    <figure className="entry-plan">
      <div className="entry-plan-heading">
        <span>Her masanın yeri belli.</span>
        <span>Salon planı</span>
      </div>
      <svg className="entry-plan-drawing" viewBox="0 0 480 258" role="img" aria-label="Altı masa, oturma alanı ve servis tezgâhından oluşan örnek restoran yerleşimi">
        <defs>
          <g id="entry-plan-table">
            <rect className="plan-chair" x="-16" y="-42" width="32" height="12" rx="5"/>
            <rect className="plan-chair" x="-16" y="30" width="32" height="12" rx="5"/>
            <rect className="plan-chair" x="-42" y="-16" width="12" height="32" rx="5"/>
            <rect className="plan-chair" x="30" y="-16" width="12" height="32" rx="5"/>
            <rect className="plan-table" x="-27" y="-27" width="54" height="54" rx="14"/>
          </g>
        </defs>
        <path className="plan-wall" d="M193 240H28V18H452V240H284"/>
        <path className="plan-door" d="M199 240V193A47 47 0 0 1 246 240"/>
        <path className="plan-window" d="M54 18H155M183 18H284M312 18H413"/>
        <rect className="plan-counter" x="386" y="48" width="42" height="145" rx="8"/>
        <text className="plan-zone" x="407" y="123" textAnchor="middle" transform="rotate(-90 407 123)">Servis</text>
        <g transform="translate(101 83)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">01</text></g>
        <g transform="translate(215 83)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">02</text></g>
        <g transform="translate(329 83)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">03</text></g>
        <g transform="translate(101 184)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">04</text></g>
        <g className="plan-highlight" transform="translate(215 184)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">05</text></g>
        <g transform="translate(329 184)"><use href="#entry-plan-table"/><text className="plan-number" textAnchor="middle" y="5">06</text></g>
      </svg>
      <figcaption>Örnek yerleşim. Restoranınızın masa planı girişten sonra açılır.</figcaption>
    </figure>
  );
}

export function LoginPage({health, healthError, retry, onLogin}: LoginPageProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submitting = useRef(false);
  const canSubmit = !busy && name.trim().length > 0 && password.length > 0 && health != null;
  const status = healthError
    ? 'Sunucuya ulaşılamadı'
    : health == null
      ? 'Sunucuya bağlanılıyor…'
      : health.Mode === 'Demo'
        ? 'Demo ortamı hazır'
        : health.DatabaseReady
          ? 'Sistem girişe hazır'
          : 'Veritabanı bağlantısı bekleniyor';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      onLogin(await login(name, password));
    } catch (err) {
      setError(err);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="entry-page">
      <header className="entry-header">
        <div className="entry-wordmark" aria-label="ATIA Restorant">
          <span>ATIA</span><span>Restorant</span>
        </div>
        <ThemeToggle/>
      </header>

      <main className="entry-main">
        <section className="entry-story" aria-labelledby="entry-title">
          <div className="entry-intro">
            <h1 id="entry-title">Restoranınızı<br/>tek merkezden yönetin.</h1>
            <p>Masa planından mutfağa, siparişten günün raporuna.<br className="entry-desktop-break"/> Restoranınızın tüm akışı, tek bir panelde.</p>
          </div>
          <RestaurantPlan/>
          <div className="entry-story-footer">Daha düzenli bir servis. Daha rahat bir iş günü.</div>
        </section>

        <section className="entry-access" aria-labelledby="entry-access-title">
          <div className="entry-form-wrap">
            <div className="entry-form-heading">
              <span className="entry-lock" aria-hidden="true"><LockKeyhole size={22} strokeWidth={1.6}/></span>
              <h2 id="entry-access-title">Hoş geldiniz.</h2>
              <p>İş gününüze buradan devam edin.<br/>Personel hesabınızla giriş yapın.</p>
            </div>

            <ErrorBox error={healthError} retry={retry}/>
            <form className="entry-form" onSubmit={submit} aria-busy={busy}>
              <div className="entry-field">
                <label htmlFor="lp-username">Kullanıcı adı</label>
                <input id="lp-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="Kullanıcı adınız" value={name} onChange={event => setName(event.target.value)} disabled={busy}/>
              </div>
              <div className="entry-field">
                <label htmlFor="lp-password">Şifre</label>
                <div className="entry-password">
                  <input id="lp-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Şifreniz" value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/>
                  <button type="button" className="entry-reveal" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}
                  </button>
                </div>
              </div>
              <ErrorBox error={error}/>
              <button className="entry-submit" type="submit" disabled={!canSubmit}>
                {busy ? <><span className="entry-spinner" aria-hidden="true"/>Giriş yapılıyor…</> : 'Giriş yap'}
              </button>
            </form>
            <p className="entry-help">Hesabınıza erişemiyor musunuz?<br/><span>Restoran yöneticinizle iletişime geçin.</span></p>
          </div>
          <div className={`entry-status${healthError ? ' entry-status-error' : ''}`} role="status">
            <span className="entry-status-mark" aria-hidden="true"/>{status}
          </div>
        </section>
      </main>
    </div>
  );
}
