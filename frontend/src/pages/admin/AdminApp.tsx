import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, Download, History, KeyRound, LayoutDashboard, LogOut, Network, Settings as SettingsIcon } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BrandBar } from '../../components/Brand';
import { Alert, Button, Card, cx, Loading, Select, TextField } from '../../components/ui';
import { api, session } from '../../lib/api';
import { useSignedOutRedirect } from '../../lib/useSignedOut';
import Activity from './Activity';
import Codes from './Codes';
import DistrictReview from './DistrictReview';
import Districts from './Districts';
import Downloads from './Downloads';
import Overview from './Overview';
import Settings from './Settings';
import Structure from './Structure';

export interface AdminRegion {
  id: number;
  name: string;
  code: string;
  active: boolean;
  political_regions: string[];
  registration_key: string | null;
}
export interface AdminMe {
  id: number;
  email: string;
  name: string;
  region_id: number | null;
  regions: AdminRegion[];
}

interface Ctx {
  me: AdminMe;
  region: AdminRegion;
  /** Appends ?regionId= so every request is scoped to the chosen region. */
  q: (path: string) => string;
  reloadMe: () => Promise<void>;
}
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

const NAV = [
  { to: '/admin', label: 'Overview', end: true, icon: LayoutDashboard },
  { to: '/admin/districts', label: 'Districts', icon: Building2 },
  { to: '/admin/structure', label: 'Structure', icon: Network },
  { to: '/admin/codes', label: 'Access codes', icon: KeyRound },
  { to: '/admin/downloads', label: 'Downloads', icon: Download },
  { to: '/admin/activity', label: 'Activity', icon: History },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AdminApp() {
  const [signedIn, setSignedIn] = useState(!!session.admin());
  useEffect(() => {
    const h = (e: Event) => (e as CustomEvent).detail === 'admin' && setSignedIn(false);
    window.addEventListener('gnat:signed-out', h);
    return () => window.removeEventListener('gnat:signed-out', h);
  }, []);
  return signedIn ? <AdminShell onSignOut={() => setSignedIn(false)} /> : <Login onDone={() => setSignedIn(true)} />;
}

function AdminShell({ onSignOut }: { onSignOut: () => void }) {
  useSignedOutRedirect('/admin');
  const nav = useNavigate();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [regionId, setRegionId] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem('gnat.admin.region')) || null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);

  const reloadMe = async () => {
    try {
      setMe(await api.admin.get<AdminMe>('/admin/me'));
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    reloadMe();
  }, []);

  const region = me ? (me.regions.find((r) => r.id === regionId) ?? me.regions.find((r) => r.active) ?? me.regions[0]) : null;
  const rid = region?.id;
  // Stable per region so pages can list it as an effect dependency without refetch loops.
  const q = useCallback((p: string) => `${p}${p.includes('?') ? '&' : '?'}regionId=${rid}`, [rid]);
  const ctx = useMemo<Ctx | null>(() => (me && region ? { me, region, reloadMe, q } : null), [me, region, q]);

  if (error) return <div className="p-6"><Alert tone="error">{error}</Alert></div>;
  if (!me || !region || !ctx) return <Loading />;

  const signOut = () => {
    session.setAdmin(null);
    onSignOut();
    nav('/admin');
  };

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="min-h-dvh">
        <BrandBar
          subtitle={`${region.name} Region · Admin`}
          right={
            <>
              {me.regions.filter((r) => r.active || r.id === region.id).length > 1 && (
                <Select
                  aria-label="Region"
                  className="h-9 w-40 text-sm"
                  value={region.id}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setRegionId(id);
                    try {
                      localStorage.setItem('gnat.admin.region', String(id));
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {me.regions
                    .filter((r) => r.active || r.id === region.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              )}
              <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={signOut}>
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </>
          }
        />
        <div className="mx-auto max-w-6xl px-4 lg:flex lg:gap-6">
          <nav aria-label="Admin" className="no-print -mx-4 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:w-48 lg:shrink-0 lg:border-0 lg:px-0 lg:pt-6">
            <ul className="flex gap-1 py-2 lg:sticky lg:top-20 lg:flex-col lg:py-0">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold',
                        isActive ? 'bg-brand text-brand-ink' : 'text-ink-2 hover:bg-surface-2',
                      )
                    }
                  >
                    <n.icon className="h-4 w-4" aria-hidden />
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <main className="min-w-0 flex-1 py-6" key={region.id}>
            <Routes>
              <Route index element={<Overview />} />
              <Route path="districts" element={<Districts />} />
              <Route path="districts/:id" element={<DistrictReview />} />
              <Route path="structure" element={<Structure />} />
              <Route path="codes" element={<Codes />} />
              <Route path="downloads" element={<Downloads />} />
              <Route path="activity" element={<Activity />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-h-dvh">
      <BrandBar subtitle="Regional Secretary" />
      <main className="mx-auto max-w-sm px-4 pt-10">
        <Card title="Admin sign in">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api.pub.post<{ token: string; name: string; email: string }>('/admin/login', { email, password });
                session.setAdmin(r);
                onDone();
              } catch (err: any) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" className="w-full" size="lg" busy={busy}>
              Sign in
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
