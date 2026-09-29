import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, LogOut, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { session } from '../lib/api';
import type { Status } from '../lib/api';
import type { PoliticalDistrict } from '../lib/types';
import { BrandBar, Footer } from './Brand';
import { GuideButton, GuideDialog, useGuide } from './Guide';
import type { GuideRole } from '../lib/guides';
import { Alert, Button, cx, Input, StatusBadge } from './ui';

/** `guide`: the role guide to show on this person's first sign-in and from the Guide button. */
export function ChairShell({
  subtitle,
  guide,
  children,
}: {
  subtitle: string;
  guide?: { role: GuideRole; key: string };
  children: ReactNode;
}) {
  const nav = useNavigate();
  const g = useGuide(guide ? `${guide.role}.${guide.key}` : null);
  return (
    <div className="min-h-dvh pb-28">
      {guide && <GuideDialog role={guide.role} open={g.open} onClose={g.close} />}
      <BrandBar
        subtitle={subtitle}
        right={
          <>
            {guide && <GuideButton onClick={g.show} />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                session.setChair(null);
                nav('/');
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </>
        }
      />
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
      <Footer />
    </div>
  );
}

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: { label: string; done: boolean }[];
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav aria-label="Form steps" className="no-print relative -mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max gap-1.5">
        {steps.map((s, i) => {
          const active = i === current;
          return (
            <li key={s.label}>
              <button
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className={cx(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                  active ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                <span
                  className={cx(
                    'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                    active ? 'bg-brand-ink text-brand' : s.done ? 'bg-[var(--st-approved)] text-white' : 'bg-surface-2 text-ink-3',
                  )}
                  aria-hidden
                >
                  {s.done && !active ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
                {s.done && <span className="sr-only">(complete)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StatusBanner({
  status,
  adminNote,
  what,
  onReopen,
}: {
  status: Status;
  adminNote: string | null;
  what: string;
  onReopen?: () => void;
}) {
  if (status === 'returned')
    return (
      <Alert tone="warn" title={`The Regional Secretary returned this ${what} for correction`}>
        {adminNote && <p className="mt-1 whitespace-pre-wrap">“{adminNote}”</p>}
        <p className="mt-1">Make the changes, then submit again.</p>
      </Alert>
    );
  if (status === 'submitted')
    return (
      <Alert tone="info" title="Submitted. Thank you!">
        <p>Your {what} is waiting for the Regional Secretary's review. It's locked while under review.</p>
        {onReopen && (
          <Button size="sm" variant="secondary" className="mt-2" onClick={onReopen}>
            Reopen to make changes
          </Button>
        )}
      </Alert>
    );
  if (status === 'approved')
    return (
      <Alert tone="success" title="Approved">
        The Regional Secretary has approved this {what}. It can no longer be changed here; contact the Secretary if something is wrong.
      </Alert>
    );
  return null;
}

export function TitleRow({ title, status, children }: { title: string; status: Status; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {children}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

/** Sticky bottom bar with Back / Next, so the next action is always under the thumb. */
export function StepNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextIcon: NextIcon = ArrowRight,
  nextBusy,
  nextDisabled,
  extra,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextIcon?: LucideIcon;
  nextBusy?: boolean;
  nextDisabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        {onBack ? (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex items-center gap-2">
          {extra}
          {onNext && (
            <Button onClick={onNext} busy={nextBusy} disabled={nextDisabled}>
              {nextLabel}
              {!nextBusy && <NextIcon className="h-4 w-4" aria-hidden />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PoliticalPicker({
  all,
  selected,
  onChange,
  disabled,
}: {
  all: PoliticalDistrict[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const sel = new Set(selected);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((d) => d.name.toLowerCase().includes(s)) : all;
  }, [all, q]);
  const toggle = (id: number) => onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected">
          {all
            .filter((d) => sel.has(d.id))
            .map((d) => (
              <button
                key={d.id}
                disabled={disabled}
                onClick={() => toggle(d.id)}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-sm font-semibold text-brand-ink disabled:opacity-70"
                aria-label={`Remove ${d.name}`}
              >
                {d.name} {!disabled && <X className="h-3.5 w-3.5" aria-hidden />}
              </button>
            ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          className="pl-9"
          placeholder={`Search ${all.length} districts…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          aria-label="Search political districts"
        />
      </div>
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {shown.map((d) => (
          <li key={d.id}>
            <label
              className={cx(
                'flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--brand)]"
                checked={sel.has(d.id)}
                onChange={() => toggle(d.id)}
                disabled={disabled}
              />
              <span className="flex-1 text-ink">{d.name}</span>
              <span className="text-xs text-ink-3">{d.kind}</span>
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-4 text-sm text-ink-3">No match for “{q}”.</li>}
      </ul>
    </div>
  );
}
