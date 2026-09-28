import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function BrandBar({ right, subtitle }: { right?: ReactNode; subtitle?: string }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
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

export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-6xl px-4 py-8 text-center text-xs text-ink-3">
      Ghana National Association of Teachers · <span className="italic">We live to teach</span>
      <br />
      Workplace names identify where members serve; they do not imply that agencies report to GNAT.
    </footer>
  );
}
