import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, FlaskConical, Globe2, LayoutDashboard, LogIn, RotateCcw, School, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandBar, Footer } from '../components/Brand';
import { Alert, Button, Card, CopyButton, Loading, StatusBadge, useConfirm, useToast } from '../components/ui';
import { api, ApiError, session } from '../lib/api';
import type { Status } from '../lib/api';

interface DemoInfo {
  password: string;
  registrationKey: string;
  admins: { email: string; label: string }[];
  districts: { name: string; status: Status; chairName: string | null; code: string }[];
  locals: { name: string; district: string; status: Status; chairName: string | null; code: string }[];
}

const STATUS_HINT: Record<Status, string> = {
  draft: 'Still filling in the form',
  submitted: 'Submitted and waiting for review (locked)',
  returned: 'Returned by the Regional Secretary with a note',
  approved: 'Approved (read only)',
};

export default function Demo() {
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [info, setInfo] = useState<DemoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notDemo, setNotDemo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    api.pub.get<DemoInfo>('/demo').then(setInfo, (e: ApiError) => (e.status === 404 ? setNotDemo(true) : setError(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function asAdmin(email: string) {
    setBusy(email);
    try {
      const r = await api.pub.post<{ token: string; name: string; email: string }>('/admin/login', {
        login: email,
        password: info!.password,
      });
      session.setAdmin(r);
      nav('/admin');
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(null);
    }
  }

  async function asChair(code: string) {
    setBusy(code);
    try {
      const r = await api.pub.post<{ role: 'district' | 'local'; token: string; name: string }>('/access', { code });
      session.setChair(r);
      nav(r.role === 'district' ? '/district' : '/local');
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(null);
    }
  }

  async function reset() {
    const { ok } = await confirm({
      title: 'Reset the demo?',
      body: 'Everyone testing shares this data. Resetting brings back the original districts, gives every district and local a new code and signs all testers out.',
      confirm: 'Reset',
      danger: true,
    });
    if (!ok) return;
    setBusy('reset');
    try {
      await api.pub.post('/demo/reset');
      session.setChair(null);
      session.setAdmin(null);
      await load();
      toast('Demo data reset');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh">
      <BrandBar subtitle="Demo: try every role" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink">
            <FlaskConical className="h-6 w-6 text-brand" aria-hidden />
            Try every role
          </h1>
          <p className="mt-1 text-ink-2">
            Tap a role to sign in as that person. The districts, people and phone numbers are fictional, and everyone testing shares them.
          </p>
        </div>

        {notDemo && (
          <Alert tone="info" title="This is not the demo site">
            This site holds real data, so there are no demo sign-ins here.{' '}
            <Link to="/" className="font-semibold text-brand">
              Go to the home page
            </Link>
            .
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {!info && !notDemo && !error && <Loading />}

        {info && (
          <>
            <Role
              icon={LayoutDashboard}
              title="Regional Secretary"
              sub="Review, approve or return submissions, see charts, manage codes and settings, download Excel, CSV and PDF."
            >
              <ul className="space-y-2">
                {info.admins.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold text-ink">
                        {a.label.startsWith('National') && <Globe2 className="h-4 w-4 text-ink-3" aria-hidden />}
                        {a.label}
                      </p>
                      <p className="break-all text-xs text-ink-3">{a.email}</p>
                    </div>
                    <Button size="sm" busy={busy === a.email} onClick={() => asAdmin(a.email)}>
                      <LogIn className="h-4 w-4" aria-hidden />
                      Sign in
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                Or type it on the{' '}
                <Link to="/admin" className="font-semibold text-brand">
                  admin page
                </Link>
                . Password: <code className="code-font rounded bg-surface-2 px-1.5 py-0.5 text-ink">{info.password}</code>
                <CopyButton text={info.password} />
              </p>
            </Role>

            <Role
              icon={Building2}
              title="District Secretaries"
              sub="Choose the political districts the district covers, list its locals, share their codes, and submit."
            >
              <CodeList
                rows={info.districts.map((d) => ({ key: d.code, title: d.name, sub: d.chairName, status: d.status, code: d.code }))}
                busy={busy}
                onOpen={asChair}
              />
            </Role>

            <Role
              icon={School}
              title="Local Secretaries"
              sub="List the schools and workplaces in the local, with optional GPS addresses or an Excel import, and submit."
            >
              <CodeList
                rows={info.locals.map((l) => ({
                  key: l.code,
                  title: l.name,
                  sub: `${l.district} district${l.chairName ? ` · ${l.chairName}` : ''}`,
                  status: l.status,
                  code: l.code,
                }))}
                busy={busy}
                onOpen={asChair}
              />
            </Role>

            <Role
              icon={UserPlus}
              title="A new District Secretary"
              sub="Register a district from scratch, the way a District Secretary would from the WhatsApp link."
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                Registration key: <code className="code-font rounded bg-surface-2 px-1.5 py-0.5 text-ink">{info.registrationKey}</code>
                <CopyButton text={info.registrationKey} />
                <Link
                  to="/register"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink hover:opacity-90"
                >
                  Register a district
                </Link>
              </div>
            </Role>

            <Card title="A suggested test">
              <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-ink-2">
                <li>
                  As the <b>Bantama</b> Local Secretary, add two schools (one with a GPS address such as AK-039-5028), import a few from
                  Excel, then submit.
                </li>
                <li>
                  As the <b>Kumasi Metro</b> District Secretary, see Bantama submitted, fill <b>Suame</b> on its secretary's behalf, then
                  submit the district.
                </li>
                <li>
                  As the <b>Regional Secretary</b>, open Kumasi Metro, return it with a note or approve it, then download the Excel and PDF.
                </li>
                <li>Try it on your phone too. Every page works on a small screen and a slow network.</li>
              </ol>
            </Card>

            <Card title="Start again">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-2">Put the original demo data back. Every code changes and all testers are signed out.</p>
                <Button variant="danger" busy={busy === 'reset'} onClick={reset}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Reset demo data
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Role({ icon: Icon, title, sub, children }: { icon: LucideIcon; title: string; sub: string; children: ReactNode }) {
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand" aria-hidden />
          {title}
        </span>
      }
      subtitle={sub}
    >
      {children}
    </Card>
  );
}

function CodeList({
  rows,
  busy,
  onOpen,
}: {
  rows: { key: string; title: string; sub: string | null; status: Status; code: string }[];
  busy: string | null;
  onOpen: (code: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              {r.title} <StatusBadge status={r.status} />
            </p>
            <p className="text-xs text-ink-3">
              {r.sub ? `${r.sub} · ` : ''}
              {STATUS_HINT[r.status]} · <span className="code-font">{r.code}</span>
            </p>
          </div>
          <Button size="sm" variant="secondary" busy={busy === r.code} onClick={() => onOpen(r.code)}>
            <LogIn className="h-4 w-4" aria-hidden />
            Sign in
          </Button>
        </li>
      ))}
    </ul>
  );
}
