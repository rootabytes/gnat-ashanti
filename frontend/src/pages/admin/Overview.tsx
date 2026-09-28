import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Loading, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';
import type { Status } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { PageTitle, useAdmin } from './AdminApp';
import { CategoryChart, LocalsPerDistrictChart, StatTile, StatusBar, TimelineChart } from './charts';

export interface OverviewData {
  region: { id: number; name: string };
  totals: { districts: number; locals: number; units: number; politicalDistricts: number; politicalCovered: number };
  districtStatus: Record<Status, number>;
  localStatus: Record<Status, number>;
  unitsByCategory: { category: string; label: string; count: number }[];
  perDistrict: {
    id: number;
    name: string;
    status: Status;
    verified: boolean;
    chairName: string | null;
    chairPhone: string | null;
    updatedAt: string;
    submittedAt: string | null;
    locals: number;
    localsDone: number;
    units: number;
    political: number;
  }[];
  coverage: { id: number; name: string; kind: string; gnatDistricts: string[] }[];
  timeline: { day: string; districts: number; locals: number; registrations: number }[];
  recent: AuditRow[];
}
export interface AuditRow {
  id: number;
  actor_type: string;
  actor_label: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_name: string | null;
  detail: any;
  created_at: string;
}

interface Dup {
  name: string;
  entries: { local: string; localId: number; district: string; districtId: number; category: string }[];
}

export default function Overview() {
  const { q, region } = useAdmin();
  const [data, setData] = useState<OverviewData | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      Promise.all([api.admin.get<OverviewData>(q('/admin/overview')), api.admin.get<Dup[]>(q('/admin/duplicates'))]).then(
        ([o, d]) => {
          setData(o);
          setDups(d);
        },
        (e) => setError(e.message),
      );
    load();
    // Light polling so the dashboard stays live while chairmen are submitting.
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 60_000);
    return () => window.clearInterval(t);
  }, [q]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Loading />;

  const t = data.totals;
  const uncovered = data.coverage.filter((c) => !c.gnatDistricts.length);
  const needsReview = data.perDistrict.filter((d) => d.status === 'submitted');

  return (
    <div className="space-y-5">
      <PageTitle title={`${region.name} Region overview`} sub="Live progress of the GNAT mapping exercise. Updates every minute." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="GNAT districts" value={t.districts} sub={`${data.districtStatus.submitted + data.districtStatus.approved} submitted`} />
        <StatTile label="GNAT locals" value={t.locals} sub={`${data.localStatus.submitted + data.localStatus.approved} submitted`} />
        <StatTile label="Workplaces" value={t.units} sub="basic units & institutions" />
        <StatTile label="Political districts covered" value={`${t.politicalCovered}/${t.politicalDistricts}`} sub={uncovered.length ? `${uncovered.length} not yet covered` : 'All covered'} />
      </div>

      <Card title="Submission progress">
        <div className="grid gap-6 md:grid-cols-2">
          <StatusBar label="Districts" counts={data.districtStatus} />
          <StatusBar label="Locals" counts={data.localStatus} />
        </div>
        {needsReview.length > 0 && (
          <div className="mt-4">
            <Alert tone="info" title={`${needsReview.length} district${needsReview.length === 1 ? '' : 's'} waiting for your review`}>
              <div className="mt-1 flex flex-wrap gap-2">
                {needsReview.map((d) => (
                  <Link key={d.id} to={`/admin/districts/${d.id}`} className="font-semibold text-brand underline">
                    {d.name}
                  </Link>
                ))}
              </div>
            </Alert>
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <CategoryChart data={data.unitsByCategory} />
        <LocalsPerDistrictChart data={data.perDistrict} />
      </div>

      <TimelineChart data={data.timeline} />

      <CoverageCard coverage={data.coverage} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Possible duplicate workplaces" subtitle="Same name listed under more than one local. Check whether it's the same place.">
          {dups.length ? (
            <ul className="space-y-3 text-sm">
              {dups.slice(0, 30).map((d) => (
                <li key={d.name}>
                  <p className="font-semibold text-ink">{d.name}</p>
                  <ul className="mt-0.5 text-ink-2">
                    {d.entries.map((e, i) => (
                      <li key={i}>
                        • <Link className="text-brand underline" to={`/admin/districts/${e.districtId}`}>{e.district}</Link> › {e.local}{' '}
                        <span className="text-ink-3">({e.category})</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No duplicates found.</p>
          )}
        </Card>

        <Card title="Recent activity" action={<Link to="/admin/activity" className="text-sm font-semibold text-brand">All activity →</Link>}>
          <ActivityList rows={data.recent.slice(0, 12)} />
        </Card>
      </div>

      <Card title="District tracker" action={<Link to="/admin/districts" className="text-sm font-semibold text-brand">Open tracker →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="py-2 pr-3 font-semibold">District</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 text-right font-semibold">Locals done</th>
                <th className="py-2 pr-3 text-right font-semibold">Workplaces</th>
                <th className="py-2 font-semibold">Last update</th>
              </tr>
            </thead>
            <tbody>
              {data.perDistrict.map((d) => (
                <tr key={d.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <Link to={`/admin/districts/${d.id}`} className="font-semibold text-brand hover:underline">{d.name}</Link>
                  </td>
                  <td className="py-2 pr-3"><StatusBadge status={d.status} /></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.localsDone}/{d.locals}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.units}</td>
                  <td className="py-2 text-ink-3">{timeAgo(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.perDistrict.length && <p className="py-6 text-center text-sm text-ink-3">No districts have registered yet. Share the registration link from Settings.</p>}
        </div>
      </Card>
    </div>
  );
}

function CoverageCard({ coverage }: { coverage: OverviewData['coverage'] }) {
  const [onlyGaps, setOnlyGaps] = useState(false);
  const covered = coverage.filter((c) => c.gnatDistricts.length).length;
  const shown = onlyGaps ? coverage.filter((c) => !c.gnatDistricts.length) : coverage;
  return (
    <Card
      title="Political district coverage"
      subtitle={`${covered} of ${coverage.length} political administrative districts are mapped to a GNAT district`}
      action={
        <label className="no-print flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />
          Only not covered
        </label>
      }
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${covered} of ${coverage.length} covered`}>
        <div className="h-full rounded-full" style={{ width: `${coverage.length ? (covered / coverage.length) * 100 : 0}%`, background: 'var(--st-approved)' }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => {
          const ok = c.gnatDistricts.length > 0;
          return (
            <li key={c.id} className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-sm ${ok ? 'bg-[var(--st-approved-bg)]' : 'border border-dashed border-line'}`}>
              <span aria-hidden className="font-bold" style={{ color: ok ? 'var(--st-approved)' : 'var(--ink-3)' }}>
                {ok ? '✓' : '○'}
              </span>
              <div className="min-w-0">
                <p className={ok ? 'font-semibold text-ink' : 'text-ink-2'}>
                  {c.name} <span className="text-xs font-normal text-ink-3">{c.kind}</span>
                </p>
                {ok && <p className="truncate text-xs text-ink-2">GNAT: {c.gnatDistricts.join(', ')}</p>}
                {!ok && <span className="sr-only">Not yet covered</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ACTION_TEXT: Record<string, string> = {
  'district.register': 'registered district',
  'district.create': 'created district',
  'district.submit': 'submitted district',
  'district.reopen': 'reopened district',
  'district.approved': 'approved district',
  'district.returned': 'returned district',
  'district.draft': 'moved district back to in-progress',
  'district.approve_all': 'approved district and its locals',
  'district.political': 'updated political districts of',
  'district.edit': 'edited district',
  'district.delete': 'deleted district',
  'district.reset_code': 'reset the code of district',
  'local.create': 'added local',
  'local.units': 'updated workplaces of local',
  'local.submit': 'submitted local',
  'local.reopen': 'reopened local',
  'local.approved': 'approved local',
  'local.returned': 'returned local',
  'local.draft': 'moved local back to in-progress',
  'local.delete': 'deleted local',
  'local.reset_code': 'reset the code of local',
  'admin.login': 'signed in',
  'export.xlsx': 'downloaded Excel',
  'export.csv': 'downloaded CSV',
  'export.pdf': 'downloaded PDF report',
  'region.edit': 'changed region settings',
  'political.create': 'added political district',
  'admin.create': 'added an admin',
};

export function ActivityList({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="text-sm text-ink-3">Nothing yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => {
        const who = r.actor_label ?? (r.actor_type === 'district' ? 'District chairman' : r.actor_type === 'local' ? 'Local chairman' : r.actor_type === 'admin' ? 'Admin' : 'Someone');
        const name = r.entity_name ?? r.detail?.name ?? '';
        return (
          <li key={r.id} className="flex justify-between gap-3">
            <span className="text-ink-2">
              <b className="text-ink">{who}</b> {ACTION_TEXT[r.action] ?? r.action} {name && <b className="text-ink">{name}</b>}
              {r.detail?.by === 'district' && <span className="text-ink-3"> (by district)</span>}
              {r.detail?.note && <span className="text-ink-3"> · “{r.detail.note}”</span>}
            </span>
            <span className="shrink-0 text-xs text-ink-3">{timeAgo(r.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
