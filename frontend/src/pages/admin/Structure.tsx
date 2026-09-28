import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, Input, Loading, Select, StatusBadge } from '../../components/ui';
import { GpsTag } from '../../components/UnitsEditor';
import { api } from '../../lib/api';
import type { Status } from '../../lib/api';
import { plural } from '../../lib/format';
import { useMeta } from '../../lib/useMeta';
import { PageTitle, useAdmin } from './AdminApp';

interface Tree {
  region: { id: number; name: string };
  districts: {
    id: number;
    name: string;
    status: Status;
    chairName: string | null;
    politicalDistricts: string[];
    locals: {
      id: number;
      name: string;
      status: Status;
      chairName: string | null;
      units: { id: number; name: string; category: string; gpsAddress: string | null }[];
    }[];
  }[];
}

export default function Structure() {
  const { q } = useAdmin();
  const { meta } = useMeta();
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');

  useEffect(() => {
    api.admin.get<Tree>(q('/admin/tree')).then(setTree, (e) => setError(e.message));
  }, [q]);

  // Filtering keeps the path to every match visible (district → local → unit).
  const filtered = useMemo(() => {
    if (!tree) return [];
    const s = search.trim().toLowerCase();
    if (!s && !cat) return tree.districts;
    return tree.districts
      .map((d) => {
        const dHit = !cat && !!s && (d.name.toLowerCase().includes(s) || d.politicalDistricts.some((p) => p.toLowerCase().includes(s)));
        const locals = d.locals
          .map((l) => {
            const lHit = !cat && !!s && l.name.toLowerCase().includes(s);
            const units = l.units.filter((u) => (!cat || u.category === cat) && (!s || lHit || dHit || u.name.toLowerCase().includes(s)));
            return { ...l, units: lHit || dHit ? (cat ? units : l.units) : units, keep: lHit || dHit || units.length > 0 };
          })
          .filter((l) => l.keep && (!cat || l.units.length));
        return { ...d, locals, keep: dHit || locals.length > 0 };
      })
      .filter((d) => d.keep);
  }, [tree, search, cat]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!tree) return <Loading />;

  const counts = filtered.reduce((a, d) => ({ l: a.l + d.locals.length, u: a.u + d.locals.reduce((s, l) => s + l.units.length, 0) }), {
    l: 0,
    u: 0,
  });
  const expandAll = !!(search.trim() || cat);

  return (
    <div>
      <PageTitle title="Structure" sub={`GNAT ${tree.region.name} → Districts → Locals → Basic units`} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_18rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search any district, local or workplace…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search structure"
          />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {meta?.categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="mb-3 text-sm text-ink-3">
        {plural(filtered.length, 'district')} · {plural(counts.l, 'local')} · {plural(counts.u, 'workplace')}
      </p>
      <div className="rounded-xl border border-line bg-surface">
        <p className="border-b border-line px-4 py-3 font-extrabold text-brand">GNAT {tree.region.name} Region</p>
        <ul className="divide-y divide-line">
          {filtered.map((d) => (
            <li key={d.id} className="relative">
              {/* Outside the summary: a link inside a toggle is a nested control for screen readers. */}
              <Link to={`/admin/districts/${d.id}`} className="absolute right-4 top-3 z-10 text-sm font-semibold text-brand">
                Open
              </Link>
              <details open={expandAll} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 pl-4 pr-16 hover:bg-surface-2">
                  <span className="min-w-0">
                    <ChevronRight className="mr-1.5 inline-block h-4 w-4 text-ink-3 transition group-open:rotate-90" aria-hidden />
                    <b className="text-ink">{d.name}</b>
                    <span className="ml-2 text-sm text-ink-3">{plural(d.locals.length, 'local')}</span>
                    {d.politicalDistricts.length > 0 && (
                      <span className="block pl-5 text-xs text-ink-3">Covers: {d.politicalDistricts.join(', ')}</span>
                    )}
                  </span>
                  <StatusBadge status={d.status} />
                </summary>
                <ul className="pb-2 pl-8 pr-4">
                  {d.locals.map((l) => (
                    <li key={l.id} className="border-l-2 border-line py-1 pl-3">
                      <details open={expandAll} className="group/l">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1">
                          <span>
                            <ChevronRight className="mr-1 inline-block h-4 w-4 text-ink-3 transition group-open/l:rotate-90" aria-hidden />
                            <span className="font-semibold text-ink">{l.name}</span>
                            <span className="ml-2 text-xs text-ink-3">{plural(l.units.length, 'workplace')}</span>
                          </span>
                          <StatusBadge status={l.status} />
                        </summary>
                        <ul className="ml-5 space-y-0.5 border-l border-line py-1 pl-3 text-sm">
                          {l.units.map((u) => (
                            <li key={u.id}>
                              <span className="text-ink">{u.name}</span>{' '}
                              <span className="text-xs text-ink-3">
                                · {u.category}
                                {u.gpsAddress && <GpsTag gps={u.gpsAddress} />}
                              </span>
                            </li>
                          ))}
                          {!l.units.length && <li className="text-ink-3">No workplaces yet</li>}
                        </ul>
                      </details>
                    </li>
                  ))}
                  {!d.locals.length && <li className="py-1 pl-3 text-sm text-ink-3">No locals yet</li>}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        {!filtered.length && <p className="px-4 py-8 text-center text-sm text-ink-3">Nothing matches.</p>}
      </div>
    </div>
  );
}
