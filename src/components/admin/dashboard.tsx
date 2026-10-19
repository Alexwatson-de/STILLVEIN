'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  LayoutDashboard,
  Layers3,
  Tags,
  MessageSquare,
  Settings as SettingsIcon,
  Users as UsersIcon,
  ScrollText,
  Image as ImageIcon,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import { api, clientAuth } from '@/lib/client';
import { Role, defaultSettings, SiteSettings } from '@/lib/schema';
import { Products } from './products';
import { Enquiries } from './enquiries';
import { Assets, Audit, Settings, Taxonomies, Users } from './management';
type Actor = { uid: string; email: string; role: Role };
import { OverviewPanel as Overview } from './overview';
export default function Dashboard() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');
  const [brand, setBrand] = useState(defaultSettings);
  useEffect(() => {
    api<SiteSettings>('settings')
      .then(setBrand)
      .catch(() => {});
    try {
      return onAuthStateChanged(clientAuth(), (user) => {
        setError('');
        if (!user) {
          setActor(null);
          setLoading(false);
          return;
        }
        api<Actor>('admin/me', {}, true)
          .then(setActor)
          .catch((e) => {
            setActor(null);
            setError(e.message);
          })
          .finally(() => setLoading(false));
      });
    } catch (e) {
      setLoading(false);
      setError((e as Error).message);
    }
  }, []);
  const signout = async () => {
    await signOut(clientAuth());
    setActor(null);
    setTab('overview');
  };
  if (loading)
    return (
      <main id="main" className="empty">
        Verifying staff access…
      </main>
    );
  if (!actor)
    return (
      <main id="main" className="login-page">
        <section className="login-art">
          <Link href="/" className="wordmark">
            {brand.brand}
          </Link>
          <div>
            <span className="eyebrow">THE ATLAS, BEHIND THE SCENES</span>
            <h1>
              Extraordinary materials.
              <br />
              <em>Considered details.</em>
            </h1>
            <p>Catalog & visualization management</p>
          </div>
          <Link className="text-link" href="/">
            ← Return to the public collection
          </Link>
        </section>
        <section className="login-form">
          <span className="eyebrow">STAFF ACCESS</span>
          <h2 style={{ marginTop: 20 }}>Welcome back.</h2>
          <p>Sign in with your authorized staff account.</p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                await signInWithEmailAndPassword(
                  clientAuth(),
                  String(f.get('email')),
                  String(f.get('password')),
                );
              } catch {
                setError(
                  'Sign-in failed. Check your email, password and configured Firebase connection.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input name="email" type="email" required autoComplete="username" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <button className="button dark" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in securely'} <ArrowUpRight size={16} />
            </button>
          </form>
          <button
            className="text-link"
            style={{ marginTop: 20 }}
            onClick={async () => {
              const email = prompt('Enter your staff email address for password reset.');
              if (!email) return;
              try {
                await sendPasswordResetEmail(clientAuth(), email);
                setNotice(
                  'If this account is eligible, password reset instructions have been requested.',
                );
              } catch {
                setError('Password reset is unavailable. Check Firebase email configuration.');
              }
            }}
          >
            Forgot your password?
          </button>
          <small>
            No public registration. Access is granted by an administrator, and permissions are
            checked on the server.
          </small>
        </section>
      </main>
    );
  const nav = [
    ['overview', 'Overview', LayoutDashboard, 'all'],
    ['products', 'Materials', Layers3, 'catalog'],
    ['taxonomy', 'Categories & attributes', Tags, 'catalog'],
    ['assets', 'Image library', ImageIcon, 'catalog'],
    ['enquiries', 'Conversations', MessageSquare, 'sales'],
    ['settings', 'Site & brand', SettingsIcon, 'admin'],
    ['users', 'People & permissions', UsersIcon, 'admin'],
    ['audit', 'Audit trail', ScrollText, 'admin'],
  ] as const;
  const allowed = nav.filter(
    (n) =>
      n[3] === 'all' ||
      actor.role === 'admin' ||
      (actor.role === 'editor' && n[3] === 'catalog') ||
      (actor.role === 'sales' && n[3] === 'sales'),
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="wordmark" href="/">
          {brand.brand}
        </Link>
        <span className="eyebrow">ATLAS MANAGEMENT</span>
        <nav aria-label="Admin navigation">
          {allowed.map(([key, label, Icon]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-side-bottom">
          <span>{actor.role.toUpperCase()} ACCESS</span>
          <Link href="/">Public collection ↗</Link>
          <button onClick={signout}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="admin-main">
        <div className="admin-topbar">
          <span>Workspace / {allowed.find((n) => n[0] === tab)?.[1]}</span>
          <span>{actor.email}</span>
        </div>
        {tab === 'overview' ? (
          <Overview />
        ) : tab === 'products' ? (
          <Products />
        ) : tab === 'taxonomy' ? (
          <Taxonomies />
        ) : tab === 'assets' ? (
          <Assets />
        ) : tab === 'enquiries' ? (
          <Enquiries />
        ) : tab === 'settings' ? (
          <Settings />
        ) : tab === 'users' ? (
          <Users />
        ) : (
          <Audit />
        )}
      </main>
    </div>
  );
}
