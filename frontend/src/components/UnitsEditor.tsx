import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, CloudOff, FileDown, FileSpreadsheet, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { normalizeGps } from '../lib/format';
import type { Category, Unit } from '../lib/types';
import { Alert, Button, Empty, Field, Input, Modal, Select, Spinner, Textarea, useConfirm, useToast } from './ui';

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface Props {
  units: Unit[];
  categories: Category[];
  editable: boolean;
  storageKey: string;
  save: (units: Unit[]) => Promise<Unit[]>;
  onChange?: (units: Unit[]) => void;
  /** Where to send an Excel/CSV file to be read (nothing is saved until the rows are added). */
  importPath?: string;
}

interface ImportResult {
  units: { name: string; category: string | null; gpsAddress: string | null }[];
  notes: string[];
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
  a.length === b.length &&
  a.every((u, i) => u.name === b[i].name && u.category === b[i].category && (u.gpsAddress ?? null) === (b[i].gpsAddress ?? null));

const GPS_HINT = 'Ghana Post GPS addresses look like AK-039-5028.';

/**
 * Editable list of basic units / workplaces. Every change is kept on the phone
 * first and then saved to the server a moment later, so a dropped connection
 * never loses work.
 */
export function UnitsEditor({ units: initial, categories, editable, storageKey, save, onChange, importPath }: Props) {
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState<Unit[]>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Draft | null>(() => {
    const d = readDraft(storageKey);
    return d && !same(d.units, initial) ? d : null;
  });
  const [name, setName] = useState('');
  const [gps, setGps] = useState('');
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [importCategory, setImportCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
        const saved = await save(next.map(({ name, category, gpsAddress }) => ({ name, category, gpsAddress: gpsAddress || null })));
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

  const pendingRows = useRef<Unit[] | null>(null);
  const update = (next: Unit[]) => {
    setRows(next);
    onChange?.(next);
    writeDraft(storageKey, { units: next, at: Date.now() });
    window.clearTimeout(timer.current);
    pendingRows.current = next;
    timer.current = window.setTimeout(() => {
      pendingRows.current = null;
      doSave(next);
    }, 900);
  };

  // Leaving the step (e.g. tapping Review straight after adding a school) must
  // not drop the pending save: send it now instead of waiting for the timer.
  const flushRef = useRef(doSave);
  flushRef.current = doSave;
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pendingRows.current) flushRef.current(pendingRows.current);
    },
    [],
  );

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
    const g = gps.trim() ? normalizeGps(gps) : null;
    if (gps.trim() && !g) {
      setError(GPS_HINT + ' Check it, or leave it blank.');
      return;
    }
    try {
      localStorage.setItem('gnat.lastCategory', category);
    } catch {
      /* ignore */
    }
    update([...rows, { name: n, category, gpsAddress: g }]);
    setName('');
    setGps('');
    nameRef.current?.focus();
  };

  const addBulk = () => {
    const names = bulkText
      .split(/\r?\n/)
      .map((s) =>
        s
          .replace(/^[\s\-•*\d.)]+/, '')
          .trim()
          .replace(/\s+/g, ' '),
      )
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

  const readFile = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!f || !importPath) return;
    if (f.size > 2 * 1024 * 1024) {
      setError('That file is too large. Keep it under 2 MB.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const r = await api.chair.upload<ImportResult>(importPath, f);
      setImportCategory(category);
      setImported(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const importFresh = useMemo(() => {
    if (!imported) return [];
    const seen = new Set(rows.map((r) => r.name.toLowerCase()));
    return imported.units.filter((u) => !seen.has(u.name.toLowerCase()));
  }, [imported, rows]);

  const addImported = () => {
    const next = importFresh.map((u) => ({ name: u.name, category: u.category ?? importCategory, gpsAddress: u.gpsAddress }));
    if (next.length) update([...rows, ...next]);
    toast(`${next.length} workplace${next.length === 1 ? '' : 's'} added`);
    setImported(null);
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
            <Button
              size="sm"
              onClick={() => {
                update(pending.units);
                setPending(null);
              }}
            >
              Restore it ({pending.units.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                writeDraft(storageKey, null);
                setPending(null);
              }}
            >
              Discard
            </Button>
          </div>
        </Alert>
      )}

      {editable && (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3 sm:p-4">
          {!bulk ? (
            <form
              className="grid gap-2 sm:grid-cols-[1fr_14rem_10rem_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <Input
                ref={nameRef}
                placeholder="Name of school / workplace"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                aria-label="Workplace name"
                enterKeyHint="next"
              />
              <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="GPS address (optional)"
                value={gps}
                onChange={(e) => {
                  setGps(e.target.value.toUpperCase());
                  setError(null);
                }}
                aria-label="Ghana Post GPS address (optional)"
                title={GPS_HINT}
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="done"
                className="code-font"
              />
              <Button type="submit" disabled={name.trim().length < 2}>
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </Button>
            </form>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder={'Paste or type one name per line, e.g.\nAdum Presby JHS\nSt. Peter’s Basic School'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                aria-label="List of workplaces, one per line"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-72" aria-label="Category for all">
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Button onClick={addBulk} disabled={!bulkText.trim()}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add all
                </Button>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <button
              className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-brand"
              onClick={() => setBulk((b) => !b)}
            >
              {bulk ? <ArrowLeft className="h-4 w-4" aria-hidden /> : <ClipboardList className="h-4 w-4" aria-hidden />}
              {bulk ? 'Add one at a time' : 'Have a long list? Paste many at once'}
            </button>
            {importPath && (
              <>
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? <Spinner className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
                  Import from Excel
                </button>
                <a
                  href={`${API_BASE}/units-template.xlsx`}
                  className="inline-flex min-h-8 items-center gap-1.5 text-sm text-ink-2 hover:text-brand"
                  download
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  Excel template
                </a>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  aria-label="Excel or CSV file of workplaces"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        open={!!imported}
        onClose={() => setImported(null)}
        title="Import workplaces"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImported(null)}>
              Cancel
            </Button>
            <Button onClick={addImported} disabled={!importFresh.length}>
              <Plus className="h-4 w-4" aria-hidden />
              Add {importFresh.length} workplace{importFresh.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        {imported && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              Found <b className="text-ink">{imported.units.length}</b> workplace{imported.units.length === 1 ? '' : 's'}.
              {imported.units.length > importFresh.length &&
                ` ${imported.units.length - importFresh.length} already on your list will be skipped.`}{' '}
              Nothing is saved until you add them, and you can still edit them afterwards.
            </p>
            {imported.notes.map((n) => (
              <Alert key={n} tone="warn">
                {n}
              </Alert>
            ))}
            {importFresh.some((u) => !u.category) && (
              <Field label={`Category for the ${importFresh.filter((u) => !u.category).length} without one`} htmlFor="import-category">
                <Select id="import-category" value={importCategory} onChange={(e) => setImportCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {importFresh.map((u) => (
                <li key={u.name} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                  <span className="font-medium text-ink">{u.name}</span>
                  <span className="text-ink-3">
                    {u.category ?? <i>{importCategory}</i>}
                    {u.gpsAddress && (
                      <>
                        {' '}
                        · <span className="code-font">{u.gpsAddress}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-ink">
          {rows.length} workplace{rows.length === 1 ? '' : 's'}
        </p>
        {editable && <SaveIndicator state={state} />}
      </div>
      {error && <Alert tone={state === 'offline' ? 'warn' : 'error'}>{error}</Alert>}

      {rows.length > 12 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search this list…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search workplaces"
          />
        </div>
      )}

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
                  {/* Phone: category on its own line, then GPS + remove. Wider screens: one row. */}
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <Select
                      className="h-10 basis-full sm:w-56 sm:basis-auto"
                      value={r.category}
                      aria-label={`Category of ${r.name}`}
                      onChange={(e) => {
                        const next = rows.slice();
                        next[i] = { ...r, category: e.target.value };
                        update(next);
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                    {/* Wrapped: Input is w-full, so the width lives on the box. */}
                    <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                      <Input
                        className="code-font h-10"
                        placeholder="GPS address"
                        title={GPS_HINT}
                        value={r.gpsAddress ?? ''}
                        aria-label={`GPS address of ${r.name}`}
                        autoCapitalize="characters"
                        spellCheck={false}
                        onChange={(e) => {
                          const next = rows.slice();
                          next[i] = { ...r, gpsAddress: e.target.value.toUpperCase() };
                          setRows(next);
                        }}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const g = v ? normalizeGps(v) : null;
                          const next = rows.slice();
                          if (v && !g) {
                            next[i] = { ...r, gpsAddress: lastSaved.current[i]?.gpsAddress ?? null };
                            setError(`${GPS_HINT} “${v}” is not one.`);
                            setRows(next);
                            return;
                          }
                          next[i] = { ...r, gpsAddress: g };
                          if (!same(next, lastSaved.current)) update(next);
                          else setRows(next);
                        }}
                      />
                    </div>
                    <Button
                      variant="danger"
                      className="h-10 shrink-0"
                      aria-label={`Remove ${r.name}`}
                      onClick={async () => {
                        const { ok } = await confirm({
                          title: 'Remove workplace?',
                          body: `“${r.name}” will be removed from this local.`,
                          confirm: 'Remove',
                          danger: true,
                        });
                        if (ok) update(rows.filter((_, j) => j !== i));
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-ink">{r.name}</span>
                  <span className="text-sm text-ink-3">
                    {catLabel(r.category)}
                    {r.gpsAddress && <GpsTag gps={r.gpsAddress} />}
                  </span>
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

/** A workplace's GPS address, shown after its category. */
export function GpsTag({ gps }: { gps: string }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 whitespace-nowrap">
      <MapPin className="h-3.5 w-3.5" aria-hidden />
      <span className="code-font">{gps}</span>
    </span>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-3" role="status">
        <Spinner className="h-3.5 w-3.5" /> Saving…
      </span>
    );
  if (state === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-[var(--st-approved)]" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved
      </span>
    );
  if (state === 'offline')
    return (
      <span className="inline-flex items-center gap-1 text-[var(--st-returned)]" role="status">
        <CloudOff className="h-4 w-4" aria-hidden /> Offline: kept on this phone
      </span>
    );
  if (state === 'error')
    return (
      <span className="text-danger" role="status">
        ! Not saved
      </span>
    );
  return <span className="text-ink-3">Changes save automatically</span>;
}
