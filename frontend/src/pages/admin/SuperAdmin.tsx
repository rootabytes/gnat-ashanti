// The super admin's dashboard: is the system working, who the admins are, and what happened to
// admin accounts. The super admin is not cleared for regional data, so nothing here (and nothing
// the API gives this account) shows districts, locals, workplaces, chairmen or downloads.
import { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  CheckCircle2,
  Clock,
  Database,
  GitCommitHorizontal,
  OctagonAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Alert, Button, Card, cx, Loading, useConfirm, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, timeAgo } from '../../lib/format';
import { AccountCard, AdminsCard } from './Account';
import { PageTitle, useAdmin } from './AdminApp';
import { StatTile } from './charts';

interface SystemStatus {
  database: { ok: boolean; latencyMs: number };
  version: string | null;
  startedAt: string;
  serverTime: string;
  demo: boolean;
  regions: { id: number; name: string; code: string; active: boolean; admins: number }[];
  admins: { total: number; awaiting_setup: number; expired_invites: number; active_this_week: number };
}

interface ActivityRow {
  id: number;
  actor_label: string | null;
  action: string;
  entity_type: string | null;
  created_at: string;
  region_name: string | null;
  detail: { name?: string } | null;
}

const ACTION: Record<string, string> = {
  'admin.login': 'signed in',
  'admin.create': 'added admin',
  'admin.profile': 'updated their account details',
  'admin.password': 'set their own password',
  'admin.reset_password': 'issued a new temporary password',
  'admin.remove': 'removed admin',
  'region.edit': 'changed which regions are open',
};

export function SystemPage() {
  const { reloadMe } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const [s, setS] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = () => api.admin.get<SystemStatus>('/admin/system').then(setS, (e) => setError(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!s) return <Loading />;

  const toggle = async (r: SystemStatus['regions'][number]) => {
    const { ok } = await confirm({
      title: r.active ? `Close the ${r.name} Region?` : `Open the ${r.name} Region?`,
      body: r.active
        ? 'District Chairmen in this region can no longer register. Existing chairmen and admins keep their access.'
        : 'District Chairmen in this region can register, and the region appears on the registration page.',
      confirm: r.active ? 'Close region' : 'Open region',
      danger: r.active,
    });
    if (!ok) return;
    setBusy(r.id);
    try {
      await api.admin.patch(`/admin/regions/${r.id}`, { active: !r.active });
      await Promise.all([load(), reloadMe()]);
      toast(r.active ? `${r.name} closed` : `${r.name} opened`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const healthy = s.database.ok;
  return (
    <div className="space-y-5">
      <PageTitle title="System" sub="Is everything working, and who can sign in. Regional data stays with each region's admins." />

      <Alert tone={healthy ? 'success' : 'error'} title={healthy ? 'Everything is working' : 'The database is not responding'}>
        {healthy
          ? `The API and database answered just now (database in ${s.database.latencyMs} ms). Checked every minute.`
          : 'Chairmen cannot save right now. Check the Postgres service on Railway.'}
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Database} label="Database" value={healthy ? 'OK' : 'Down'} sub={`${s.database.latencyMs} ms`} />
        <StatTile icon={Clock} label="Running since" value={timeAgo(s.startedAt).replace(' ago', '')} sub={fmtDate(s.startedAt, true)} />
        <StatTile icon={GitCommitHorizontal} label="Version" value={s.version ?? 'local'} sub={s.demo ? 'Demo mode' : 'Live'} />
        <StatTile icon={Users} label="Admins" value={s.admins.total} sub={`${s.admins.active_this_week} signed in this week`} />
      </div>

      {(s.admins.awaiting_setup > 0 || s.admins.expired_invites > 0) && (
        <Alert tone={s.admins.expired_invites ? 'warn' : 'info'} title="Admins who have not finished setting up">
          {s.admins.awaiting_setup > 0 && (
            <p>{s.admins.awaiting_setup} still to sign in for the first time with their temporary password.</p>
          )}
          {s.admins.expired_invites > 0 && (
            <p>
              {s.admins.expired_invites} temporary password{s.admins.expired_invites === 1 ? ' has' : 's have'} expired. Open <b>Admins</b>{' '}
              and tap <b>New password</b> to send another.
            </p>
          )}
        </Alert>
      )}

      <Card
        title="Regions"
        subtitle="Open a region when its Regional Secretary is ready. Each region's data is seen only by its own admins."
      >
        <ul className="divide-y divide-line">
          {s.regions.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  {r.name}
                  <span
                    className={cx(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      r.active ? 'bg-[var(--st-approved-bg)] text-[var(--st-approved)]' : 'bg-surface-2 text-ink-3',
                    )}
                  >
                    {r.active ? 'Open' : 'Closed'}
                  </span>
                </p>
                <p className="text-xs text-ink-3">
                  {r.admins} admin{r.admins === 1 ? '' : 's'}
                </p>
              </div>
              <Button size="sm" variant={r.active ? 'secondary' : 'primary'} busy={busy === r.id} onClick={() => toggle(r)}>
                {r.active ? 'Close' : 'Open'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function AdminsPage() {
  return (
    <div className="space-y-5">
      <PageTitle title="Admins" sub="Add each region's admins, send their sign-in on WhatsApp or SMS, and remove access." />
      <AdminsCard />
    </div>
  );
}

export function AccountPage() {
  return (
    <div className="space-y-5">
      <PageTitle title="Your account" />
      <AccountCard />
    </div>
  );
}

export function SuperActivity() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.admin.get<ActivityRow[]>('/admin/activity?limit=300').then(setRows, (e) => setError(e.message));
  }, []);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rows) return <Loading />;
  return (
    <div>
      <PageTitle title="Activity" sub="Your actions and every admin account event: sign-ins, set-up, passwords. The last 300." />
      <Card>
        {rows.length ? (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => {
              const failed = r.action === 'admin.remove';
              const Icon =
                r.action === 'admin.login'
                  ? ActivityIcon
                  : failed
                    ? OctagonAlert
                    : r.action === 'admin.password'
                      ? ShieldCheck
                      : CheckCircle2;
              return (
                <li key={r.id} className="flex justify-between gap-3">
                  <span className="flex min-w-0 gap-2 text-ink-2">
                    <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', failed ? 'text-danger' : 'text-ink-3')} aria-hidden />
                    <span>
                      <b className="text-ink">{r.actor_label ?? 'Admin'}</b> {ACTION[r.action] ?? r.action}
                      {r.detail?.name && r.action !== 'admin.profile' && <b className="text-ink"> {r.detail.name}</b>}
                      {r.region_name && <span className="text-ink-3"> · {r.region_name}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{timeAgo(r.created_at)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">Nothing yet.</p>
        )}
      </Card>
    </div>
  );
}
