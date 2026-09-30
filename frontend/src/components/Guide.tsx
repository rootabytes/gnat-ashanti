import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Gauge,
  KeyRound,
  Link2,
  ListPlus,
  Map as MapIcon,
  Network,
  Send,
  Share2,
  Undo2,
  UserMinus,
  UserPlus,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { guidesFor } from '../lib/guides';
import { currentRegion } from '../lib/sites';
import type { GuideIcon, GuideRole } from '../lib/guides';
import { Button, cx, Modal } from './ui';

const ICONS: Record<GuideIcon, LucideIcon> = {
  link: Link2,
  user: UserRound,
  list: ListPlus,
  excel: FileSpreadsheet,
  send: Send,
  returned: Undo2,
  map: MapIcon,
  share: Share2,
  track: Gauge,
  review: ClipboardCheck,
  key: KeyRound,
  download: Download,
  tree: Network,
  userMinus: UserMinus,
  userPlus: UserPlus,
};

/**
 * Opens the guide the first time this person signs in on this phone, and remembers they saw it.
 * `key` identifies the person (e.g. "local.Bantama"); null while that is not known yet.
 */
export function useGuide(key: string | null) {
  const storageKey = `gnat.guide.${key}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!key) return;
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* storage blocked: the Guide button still works */
    }
  }, [key, storageKey]);
  return {
    open,
    show: () => setOpen(true),
    close: () => {
      setOpen(false);
      try {
        localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        /* ignore */
      }
    },
  };
}

export function GuideButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label="Guide: how this works">
      <CircleHelp className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Guide</span>
    </Button>
  );
}

/** A short, swipe-free walkthrough: welcome, one card per step, then tips and the printable PDF. */
export function GuideDialog({ role, open, onClose }: { role: GuideRole; open: boolean; onClose: () => void }) {
  const guides = guidesFor(currentRegion());
  const g = guides[role];
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (open) setPage(0);
  }, [open]);
  const last = g.steps.length + 1;
  const step = page >= 1 && page <= g.steps.length ? g.steps[page - 1] : null;
  const Icon = step ? ICONS[step.icon] : null;
  const related = g.related ? guides[g.related] : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${g.name} guide`}
      footer={
        <>
          {page < last && (
            <Button variant="ghost" className="mr-auto" onClick={onClose}>
              Skip guide
            </Button>
          )}
          {page > 0 && (
            <Button variant="secondary" onClick={() => setPage(page - 1)}>
              Back
            </Button>
          )}
          <Button onClick={() => (page < last ? setPage(page + 1) : onClose())}>
            {page === 0 ? 'Show me' : page < last ? 'Next' : 'Get started'}
          </Button>
        </>
      }
    >
      <div className="min-h-56" aria-live="polite">
        {page === 0 && (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-brand-ink">
              <BookOpen className="h-7 w-7" aria-hidden />
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-ink">Welcome, {g.name}</h3>
            <p className="mt-2 text-[15px] text-ink-2">{g.summary}</p>
            <p className="mt-3 text-sm text-ink-3">
              {g.steps.length} quick steps. You can open this guide again any time with <b>Guide</b> at the top of the page.
            </p>
          </div>
        )}

        {step && Icon && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Step {page} of {g.steps.length}
            </p>
            <div className="mt-2 flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold leading-snug text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </div>
          </div>
        )}

        {page === last && (
          <div>
            <h3 className="text-lg font-extrabold text-ink">Good to know</h3>
            <ul className="mt-2 space-y-2">
              {g.tips.map((t) => (
                <li key={t} className="flex gap-2 text-[15px] text-ink-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={g.pdf}
                download
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 font-semibold text-brand hover:bg-surface-2"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Printable guide (PDF)
              </a>
              {related && (
                <a
                  href={related.pdf}
                  download
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 font-semibold text-brand hover:bg-surface-2"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  {related.name} guide (PDF)
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: last + 1 }, (_, i) => (
          <span key={i} className={cx('h-1.5 rounded-full transition-all', i === page ? 'w-5 bg-brand' : 'w-1.5 bg-line')} />
        ))}
      </div>
    </Modal>
  );
}
