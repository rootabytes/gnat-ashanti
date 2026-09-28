import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROOTABYTES } from '../lib/org';
import { useMeta } from '../lib/useMeta';

export function BrandBar({ right, subtitle }: { right?: ReactNode; subtitle?: string }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <DemoBanner />
      {/* GNAT colours: sky blue and red on white */}
      <div className="flex h-1" aria-hidden>
        <div className="flex-[3] bg-sky" />
        <div className="flex-1 bg-accent" />
      </div>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img src="/gnat-logo.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-brand">GNAT Mapping</p>
            {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

/** On the demo site every page says so, so nobody types real personal data into it. */
function DemoBanner() {
  const { meta } = useMeta();
  if (!meta?.demo) return null;
  return (
    <div className="px-4 py-1.5 text-center text-xs font-medium" style={{ background: 'var(--st-returned-bg)', color: 'var(--ink)' }}>
      <FlaskConical className="mr-1 inline h-3.5 w-3.5 align-[-2px]" style={{ color: 'var(--st-returned)' }} aria-hidden />
      <b>Demo site.</b> Fictional data that is reset often. Do not enter real names or phone numbers.{' '}
      <Link to="/demo" className="font-semibold text-brand underline underline-offset-2">
        Try every role
      </Link>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-6xl px-4 py-8 text-center text-xs text-ink-3">
      <p>
        Ghana National Association of Teachers · <span className="italic">We live to teach</span>
      </p>
      <p className="mt-1">Workplace names identify where members serve; they do not imply that agencies report to GNAT.</p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2">
        <Link to="/privacy" className="inline-block py-1 font-semibold text-ink-2 hover:text-brand">
          Privacy notice
        </Link>
        <span aria-hidden>·</span>
        <a href={ROOTABYTES.url} target="_blank" rel="noopener" className="inline-block py-1 text-ink-2 hover:text-brand">
          Built by <b className="font-bold">{ROOTABYTES.name}</b>
        </a>
      </p>
    </footer>
  );
}
