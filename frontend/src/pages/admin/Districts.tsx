import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Input,
  Loading,
  Modal,
  Select,
  SmsButton,
  StatusBadge,
  TextField,
  useToast,
  WhatsAppButton,
} from '../../components/ui';
import { api } from '../../lib/api';
import type { Status } from '../../lib/api';
import { fmtPhone, smsLink, timeAgo, whatsappLink } from '../../lib/format';
import type { DistrictDetail } from '../../lib/types';
import { PageTitle, useAdmin } from './AdminApp';
import type { OverviewData } from './Overview';

type Row = OverviewData['perDistrict'][number];

export default function Districts() {
  const { q } = useAdmin();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | Status | 'incomplete'>('');
  const [sort, setSort] = useState<'name' | 'updated' | 'progress'>('name');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.admin.get<OverviewData>(q('/admin/overview')).then(setData, (e) => setError(e.message));
  }, [q]);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    let r = data.perDistrict.filter(
      (d) =>
        (!s || d.name.toLowerCase().includes(s) || (d.chairName ?? '').toLowerCase().includes(s)) &&
        (!status ||
          (status === 'incomplete' ? d.status === 'draft' || d.status === 'returned' || d.localsDone < d.locals : d.status === status)),
    );
    r = [...r].sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'updated'
          ? +new Date(b.updatedAt) - +new Date(a.updatedAt)
          : progress(a) - progress(b),
    );
    return r;
  }, [data, search, status, sort]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Loading />;

  return (
    <div>
      <PageTitle
        title="Districts"
        sub="Track, remind and review every GNAT district."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add district
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search district or chairman…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="incomplete">Needs follow-up</option>
          <option value="draft">In progress</option>
          <option value="submitted">Submitted (to review)</option>
          <option value="returned">Returned</option>
          <option value="approved">Approved</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort">
          <option value="name">Sort: A–Z</option>
          <option value="updated">Sort: recently updated</option>
          <option value="progress">Sort: least progress</option>
        </Select>
      </div>

      <p className="mb-2 text-sm text-ink-3">
        {rows.length} of {data.perDistrict.length} districts
      </p>
      <ul className="space-y-2">
        {rows.map((d) => (
          <DistrictRow key={d.id} d={d} />
        ))}
      </ul>
      {!rows.length && <p className="py-10 text-center text-sm text-ink-3">No districts match.</p>}
      <AddDistrictModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function progress(d: Row) {
  const base = { draft: 0, returned: 0.25, submitted: 0.5, approved: 0.75 }[d.status];
  return base + (d.locals ? (d.localsDone / d.locals) * 0.25 : 0);
}

function DistrictRow({ d }: { d: Row }) {
  const pct = d.locals ? Math.round((d.localsDone / d.locals) * 100) : 0;
  const reminder = `Hello ${d.chairName ?? 'Chairman'}, this is a reminder from the GNAT Regional Secretariat to complete the ${d.name} District mapping form. Thank you.`;
  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/admin/districts/${d.id}`} className="text-lg font-bold text-brand hover:underline">
            {d.name}
          </Link>
          {!d.verified && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">self-registered</span>}
          <p className="text-sm text-ink-2">
            {d.chairName ?? 'No chairman'} {d.chairPhone && <span className="text-ink-3">· {fmtPhone(d.chairPhone)}</span>}
          </p>
        </div>
        <StatusBadge status={d.status} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-ink-3">Political</p>
          <p className="font-semibold tabular-nums">{d.political}</p>
        </div>
        <div>
          <p className="text-ink-3">Locals done</p>
          <p className="font-semibold tabular-nums">
            {d.localsDone}/{d.locals}
          </p>
        </div>
        <div>
          <p className="text-ink-3">Workplaces</p>
          <p className="font-semibold tabular-nums">{d.units}</p>
        </div>
        <div className="hidden sm:block">
          <p className="text-ink-3">Updated</p>
          <p className="font-semibold">{timeAgo(d.updatedAt)}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${pct}% of locals submitted`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--series-1)' }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/admin/districts/${d.id}`}
          className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink"
        >
          {d.status === 'submitted' ? 'Review' : 'Open'}
        </Link>
        {d.chairPhone && d.status !== 'approved' && (
          <>
            <WhatsAppButton href={whatsappLink(reminder, d.chairPhone)} label="Remind" />
            <SmsButton href={smsLink(reminder, d.chairPhone)} />
          </>
        )}
      </div>
    </li>
  );
}

function AddDistrictModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { q } = useAdmin();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', chairName: '', chairPhone: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a GNAT district"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            busy={busy}
            disabled={f.name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const d = await api.admin.post<DistrictDetail>(q('/admin/districts'), {
                  name: f.name,
                  chairName: f.chairName || null,
                  chairPhone: f.chairPhone || null,
                });
                toast(`${d.name} added`);
                nav(`/admin/districts/${d.id}`);
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Add district
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-2">An access code is created for the district. Send it to the chairman from the district page.</p>
        <TextField label="GNAT district name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="Chairman (optional)" value={f.chairName} onChange={(e) => setF({ ...f, chairName: e.target.value })} />
        <TextField
          label="Chairman phone (optional)"
          type="tel"
          value={f.chairPhone}
          onChange={(e) => setF({ ...f, chairPhone: e.target.value })}
        />
        {err && <Alert tone="error">{err}</Alert>}
      </div>
    </Modal>
  );
}
