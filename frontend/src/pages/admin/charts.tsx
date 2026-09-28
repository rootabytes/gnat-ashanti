import { useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, STATUS_META } from '../../components/ui';
import type { Status } from '../../lib/api';

const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

/** Card with a chart ⇄ table toggle, so no number is only readable from a colour. */
export function ChartCard({
  title,
  subtitle,
  chart,
  table,
  action,
}: {
  title: string;
  subtitle?: string;
  chart: ReactNode;
  table: ReactNode;
  action?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={() => setAsTable((t) => !t)}
            className="no-print rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            {asTable ? 'Chart' : 'Table'}
          </button>
        </div>
      }
    >
      {asTable ? <div className="max-h-96 overflow-auto">{table}</div> : chart}
    </Card>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-ink-3">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j > 0 ? 'text-right tabular-nums' : 'text-ink'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />}
          {r.label}: <b className="tabular-nums text-ink">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-4 text-sm text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

// ---------- Workplaces by category (one series, one colour) ----------

export function CategoryChart({ data }: { data: { category: string; label: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="Workplaces by category"
      subtitle={`${total} workplace${total === 1 ? '' : 's'} across the 11 categories`}
      chart={
        <div style={{ height: data.length * 34 + 20 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" width={170} tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={(payload[0].payload as any).label}
                      rows={[{ label: 'Workplaces', value: payload[0].value as number, color: 'var(--series-1)' }]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="count" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fill: 'var(--ink-2)', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<SimpleTable head={['Category', 'Workplaces']} rows={data.map((d) => [d.label, d.count])} />}
    />
  );
}

// ---------- Locals per district: submitted vs not yet ----------

export function LocalsPerDistrictChart({ data }: { data: { name: string; locals: number; localsDone: number; units: number }[] }) {
  const rows = data.map((d) => ({ name: d.name, done: d.localsDone, pending: d.locals - d.localsDone, units: d.units }));
  const items = [
    { label: 'Locals submitted', color: 'var(--series-1)' },
    { label: 'Locals not yet submitted', color: 'var(--ink-3)' },
  ];
  return (
    <ChartCard
      title="Locals per GNAT district"
      subtitle="How many locals each district has listed, and how many have submitted their workplaces"
      chart={
        rows.length ? (
          <>
            <Legend items={items} />
            <div style={{ height: Math.max(120, rows.length * 32 + 30) }}>
              <ResponsiveContainer>
                <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={axisTick} axisLine={false} tickLine={false} interval={0} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof rows)[number];
                      return (
                        <TooltipBox
                          title={p.name}
                          rows={[
                            { label: 'Submitted', value: p.done, color: 'var(--series-1)' },
                            { label: 'Not yet', value: p.pending, color: 'var(--ink-3)' },
                            { label: 'Workplaces', value: p.units },
                          ]}
                        />
                      );
                    }}
                  />
                  {/* stroke in the surface colour draws the 2px gap between stacked segments */}
                  <Bar
                    dataKey="done"
                    stackId="a"
                    fill="var(--series-1)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="pending"
                    stackId="a"
                    fill="var(--ink-3)"
                    fillOpacity={0.45}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-3">No districts yet.</p>
        )
      }
      table={
        <SimpleTable
          head={['GNAT District', 'Locals', 'Submitted', 'Workplaces']}
          rows={data.map((d) => [d.name, d.locals, d.localsDone, d.units])}
        />
      }
    />
  );
}

// ---------- Submissions over time ----------

export function TimelineChart({ data }: { data: { day: string; districts: number; locals: number; registrations: number }[] }) {
  const rows = fillDays(data);
  const items = [
    { label: 'District submissions', color: 'var(--series-1)' },
    { label: 'Local submissions', color: 'var(--series-2)' },
  ];
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (
    <ChartCard
      title="Submissions over time"
      subtitle="Daily count of submitted forms"
      chart={
        rows.length ? (
          <>
            <Legend items={items} />
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ left: -20, right: 8, top: 4, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={fmt}
                    tick={axisTick}
                    axisLine={{ stroke: 'var(--grid)' }}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof rows)[number];
                      return (
                        <TooltipBox
                          title={fmt(p.day)}
                          rows={[
                            { label: 'Districts', value: p.districts, color: 'var(--series-1)' },
                            { label: 'Locals', value: p.locals, color: 'var(--series-2)' },
                            { label: 'New registrations', value: p.registrations },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="districts" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  <Bar dataKey="locals" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-3">No submissions yet.</p>
        )
      }
      table={
        <SimpleTable
          head={['Day', 'Districts', 'Locals', 'Registrations']}
          rows={rows
            .filter((r) => r.districts || r.locals || r.registrations)
            .map((r) => [fmt(r.day), r.districts, r.locals, r.registrations])}
        />
      }
    />
  );
}

function fillDays(data: { day: string; districts: number; locals: number; registrations: number }[]) {
  if (!data.length) return [];
  const map = new Map(data.map((d) => [d.day, d]));
  const start = new Date(data[0].day + 'T00:00:00Z');
  const end = new Date();
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(map.get(day) ?? { day, districts: 0, locals: 0, registrations: 0 });
  }
  return out.slice(-45);
}

// ---------- Status progress bar (status colours, always with icon + label) ----------

export function StatusBar({ label, counts }: { label: string; counts: Record<Status, number> }) {
  const order: Status[] = ['approved', 'submitted', 'returned', 'draft'];
  const total = order.reduce((s, k) => s + counts[k], 0);
  const done = counts.approved + counts.submitted;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-ink-2">
          <b className="text-ink">{done}</b> of {total} submitted{total ? ` · ${Math.round((done / total) * 100)}%` : ''}
        </span>
      </div>
      <div
        className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={order.map((k) => `${STATUS_META[k].label}: ${counts[k]}`).join(', ')}
      >
        {total > 0 &&
          order.map((k) =>
            counts[k] ? (
              <div
                key={k}
                style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_META[k].fg }}
                title={`${STATUS_META[k].label}: ${counts[k]}`}
              />
            ) : null,
          )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {order.map((k) => (
          <li key={k} className="flex items-center gap-1">
            {(() => {
              const I = STATUS_META[k].icon;
              return <I className="h-3.5 w-3.5" style={{ color: STATUS_META[k].fg }} aria-hidden />;
            })()}
            {STATUS_META[k].label} <b className="tabular-nums text-ink">{counts[k]}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatTile({ label, value, sub, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-ink-3">
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}
