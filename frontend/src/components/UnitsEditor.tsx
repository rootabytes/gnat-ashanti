import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Unit } from '../lib/types';
import { Alert, Button, Empty, Input, Select, Spinner, Textarea, useConfirm } from './ui';

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface Props {
  units: Unit[];
  categories: Category[];
  editable: boolean;
  storageKey: string;
  save: (units: Unit[]) => Promise<Unit[]>;
  onChange?: (units: Unit[]) => void;
}

interface Draft {
  units: Unit[];
  at: number;
}

const readDraft = (k: string): Draft | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const writeDraft = (k: string, d: Draft | null) => {
  try {
    if (d) localStorage.setItem(k, JSON.stringify(d));
    else localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
};

const same = (a: Unit[], b: Unit[]) =>
  a.length === b.length && a.every((u, i) => u.name === b[i].name && u.category === b[i].category);

/**
 * Editable list of basic units / workplaces. Every change is kept on the phone
 * first and then saved to the server a moment later, so a dropped connection
 * never loses work.
 */
export function UnitsEditor({ units: initial, categories, editable, storageKey, save, onChange }: Props) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Unit[]>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Draft | null>(() => {
    const d = readDraft(storageKey);
    return d && !same(d.units, initial) ? d : null;
  });
  const [name, setName] = useState('');
  const [category, setCategory] = useState(() => {
    try {
      return localStorage.getItem('gnat.lastCategory') || categories[0]?.value || '';
    } catch {
      return categories[0]?.value || '';
    }
  });
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [q, setQ] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const lastSaved = useRef<Unit[]>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  const doSave = useCallback(
    async (next: Unit[]) => {
      setState('saving');
      setError(null);
      try {
        const saved = await save(next.map(({ name, category }) => ({ name, category })));
        lastSaved.current = saved;
        writeDraft(storageKey, null);
        setState('saved');
      } catch (e: any) {
        writeDraft(storageKey, { units: next, at: Date.now() });
        setState(e.status === 0 ? 'offline' : 'error');
        setError(e.message);
      }
    },
    [save, storageKey],
  );

  const update = (next: Unit[]) => {
    setRows(next);
    onChange?.(next);
    writeDraft(storageKey, { units: next, at: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => doSave(next), 900);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Retry automatically when the connection comes back.
  useEffect(() => {
    const on = () => {
      if (state === 'offline') doSave(rows);
    };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [state, rows, doSave]);

  const exists = (n: string, except = -1) => rows.some((r, i) => i !== except && r.name.trim().toLowerCase() === n.trim().toLowerCase());

  const add = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 2) return;
    if (exists(n)) {
      setError(`“${n}” is already on the list.`);
      return;
    }
    try {
      localStorage.setItem('gnat.lastCategory', category);
    } catch {
      /* ignore */
    }
    update([...rows, { name: n, category }]);
    setName('');
    nameRef.current?.focus();
  };

  const addBulk = () => {
    const names = bulkText
      .split(/\r?\n/)
      .map((s) => s.replace(/^[\s\-•*\d.)]+/, '').trim().replace(/\s+/g, ' '))
      .filter((s) => s.length >= 2);
    const seen = new Set(rows.map((r) => r.name.toLowerCase()));
    const fresh: Unit[] = [];
    for (const n of names) {
      if (seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      fresh.push({ name: n, category });
    }
    if (fresh.length) update([...rows, ...fresh]);
    setBulkText('');
    setBulk(false);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + 1));
    return m;
  }, [rows]);

  const catLabel = (v: string) => categories.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="space-y-4">
      {pending && editable && (
        <Alert tone="warn" title="Unsaved changes found on this phone">
          <p>You have a list from {new Date(pending.at).toLocaleString('en-GB')} that did not reach the server.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => { update(pending.units); setPending(null); }}>
              Restore it ({pending.units.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { writeDraft(storageKey, null); setPending(null); }}>
              Discard
            </Button>
          </div>
        </Alert>
      )}

      {editable && (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3 sm:p-4">
          {!bulk ? (
            <form
              className="grid gap-2 sm:grid-cols-[1fr_16rem_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <Input ref={nameRef} placeholder="Name of school / workplace" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} aria-label="Workplace name" enterKeyHint="done" />
              <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
              <Button type="submit" disabled={name.trim().length < 2}>+ Add</Button>
            </form>
          ) : (
            <div className="space-y-2">
              <Textarea placeholder={'Paste or type one name per line, e.g.\nAdum Presby JHS\nSt. Peter’s Basic School'} value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} aria-label="List of workplaces, one per line" />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-72" aria-label="Category for all">
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
                <Button onClick={addBulk} disabled={!bulkText.trim()}>Add all</Button>
              </div>
            </div>
          )}
          <button className="mt-2 text-sm font-semibold text-brand" onClick={() => setBulk((b) => !b)}>
            {bulk ? '← Add one at a time' : 'Have a long list? Paste many at once'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-ink">
          {rows.length} workplace{rows.length === 1 ? '' : 's'}
        </p>
        {editable && <SaveIndicator state={state} />}
      </div>
      {error && <Alert tone={state === 'offline' ? 'warn' : 'error'}>{error}</Alert>}

      {rows.length > 12 && <Input placeholder="Search this list…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search workplaces" />}

      {rows.length === 0 ? (
        <Empty title="No workplaces yet">{editable ? 'Add the first one above.' : null}</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {filtered.map(({ r, i }) => (
            <li key={i} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="w-7 shrink-0 text-xs tabular-nums text-ink-3">{i + 1}.</span>
              {editable ? (
                <>
                  <Input
                    className="h-10 sm:flex-1"
                    value={r.name}
                    aria-label={`Name of workplace ${i + 1}`}
                    onChange={(e) => {
                      const next = rows.slice();
                      next[i] = { ...r, name: e.target.value };
                      setRows(next);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim().replace(/\s+/g, ' ');
                      const next = rows.slice();
                      if (v.length < 2 || exists(v, i)) {
                        next[i] = lastSaved.current[i] ?? r;
                        setError(v.length < 2 ? 'Names need at least 2 letters.' : `“${v}” is already on the list.`);
                        setRows(next);
                        return;
                      }
                      next[i] = { ...r, name: v };
                      if (!same(next, lastSaved.current)) update(next);
                    }}
                  />
                  <div className="flex gap-2">
                    <Select
                      className="h-10 sm:w-64"
                      value={r.category}
                      aria-label={`Category of ${r.name}`}
                      onChange={(e) => {
                        const next = rows.slice();
                        next[i] = { ...r, category: e.target.value };
                        update(next);
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </Select>
                    <Button
                      variant="danger"
                      className="h-10 shrink-0"
                      aria-label={`Remove ${r.name}`}
                      onClick={async () => {
                        const { ok } = await confirm({ title: 'Remove workplace?', body: `“${r.name}” will be removed from this local.`, confirm: 'Remove', danger: true });
                        if (ok) update(rows.filter((_, j) => j !== i));
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-ink">{r.name}</span>
                  <span className="text-sm text-ink-3">{catLabel(r.category)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories
            .filter((c) => counts.get(c.value))
            .map((c) => (
              <span key={c.value} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                {c.value}: <b className="text-ink">{counts.get(c.value)}</b>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-3" role="status">
        <Spinner className="h-3.5 w-3.5" /> Saving…
      </span>
    );
  if (state === 'saved') return <span className="text-[var(--st-approved)]" role="status">✓ Saved</span>;
  if (state === 'offline') return <span className="text-[var(--st-returned)]" role="status">⚠ Offline: kept on this phone</span>;
  if (state === 'error') return <span className="text-danger" role="status">! Not saved</span>;
  return <span className="text-ink-3">Changes save automatically</span>;
}
