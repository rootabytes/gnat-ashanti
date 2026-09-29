import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MessageCircle,
  OctagonAlert,
  PencilLine,
  SendHorizontal,
  Smartphone,
  Undo2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Status } from '../lib/api';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

export function Button({
  variant = 'primary',
  size = 'md',
  busy,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; busy?: boolean }) {
  const v: Record<Variant, string> = {
    primary: 'bg-brand text-brand-ink hover:opacity-90',
    accent: 'bg-accent text-white hover:opacity-90',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
    ghost: 'text-ink-2 hover:bg-surface-2',
    danger: 'bg-surface text-danger border border-line hover:bg-danger-bg',
  };
  const s = { sm: 'h-8 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-12 px-5 text-base' }[size];
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed select-none',
        v[variant],
        s,
        className,
      )}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className)} aria-hidden />;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 h-11 text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/30';

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, 'pr-8', props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'h-auto py-2.5 min-h-24', props.className)} />;
}

/** Label + input wired together with an id. */
export function TextField({
  label,
  hint,
  error,
  ...rest
}: ComponentProps<'input'> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  if (rest.type === 'password') {
    return (
      <Field label={label} hint={hint} error={error} htmlFor={id}>
        <div className="relative">
          <Input id={id} aria-invalid={!!error} {...rest} type={shown ? 'text' : 'password'} className={cx('pr-12', rest.className)} />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]/30"
          >
            {shown ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <Input id={id} aria-invalid={!!error} {...rest} />
    </Field>
  );
}

export function Card({
  children,
  className,
  title,
  action,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface shadow-sm print-plain', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export const STATUS_META: Record<Status, { label: string; icon: LucideIcon; fg: string; bg: string }> = {
  draft: { label: 'In progress', icon: PencilLine, fg: 'var(--st-draft)', bg: 'var(--st-draft-bg)' },
  submitted: { label: 'Submitted', icon: SendHorizontal, fg: 'var(--st-submitted)', bg: 'var(--st-submitted-bg)' },
  returned: { label: 'Returned', icon: Undo2, fg: 'var(--st-returned)', bg: 'var(--st-returned-bg)' },
  approved: { label: 'Approved', icon: CheckCircle2, fg: 'var(--st-approved)', bg: 'var(--st-approved-bg)' },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: m.fg, background: m.bg }}
    >
      <m.icon className="h-3.5 w-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'error' | 'warn' | 'success';
  title?: ReactNode;
  children?: ReactNode;
}) {
  const t = {
    info: { fg: 'var(--brand)', bg: 'var(--brand-soft)', icon: Info },
    error: { fg: 'var(--danger)', bg: 'var(--danger-bg)', icon: OctagonAlert },
    warn: { fg: 'var(--st-returned)', bg: 'var(--st-returned-bg)', icon: AlertTriangle },
    success: { fg: 'var(--st-approved)', bg: 'var(--st-approved-bg)', icon: CheckCircle2 },
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex gap-3 rounded-lg px-4 py-3 text-sm" style={{ background: t.bg }}>
      <t.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: t.fg }} aria-hidden />
      <div className="min-w-0 text-ink">
        {title && (
          <p className="font-semibold" style={{ color: t.fg }}>
            {title}
          </p>
        )}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold text-ink-2">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-3" role="status">
      <Spinner /> {label}
    </div>
  );
}

// ---------- dialogs ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      {open && (
        <div>
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirm?: string;
  danger?: boolean;
  input?: { label: string; required?: boolean; placeholder?: string };
}
type ConfirmFn = (o: ConfirmOpts) => Promise<{ ok: boolean; value: string }>;
const ConfirmCtx = createContext<ConfirmFn>(async () => ({ ok: false, value: '' }));
export const useConfirm = () => useContext(ConfirmCtx);

type ToastT = { id: number; text: string; tone: 'success' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, tone?: ToastT['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (r: { ok: boolean; value: string }) => void }) | null>(null);
  const [value, setValue] = useState('');
  const [toasts, setToasts] = useState<ToastT[]>([]);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise((resolve) => {
        setValue('');
        setState({ ...o, resolve });
      }),
    [],
  );
  const toast = useCallback((text: string, tone: ToastT['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const close = (ok: boolean) => {
    state?.resolve({ ok, value });
    setState(null);
  };
  const inputId = useId();

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        <Modal
          open={!!state}
          onClose={() => close(false)}
          title={state?.title ?? ''}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                variant={state?.danger ? 'accent' : 'primary'}
                disabled={!!state?.input?.required && !value.trim()}
                onClick={() => close(true)}
              >
                {state?.confirm ?? 'Confirm'}
              </Button>
            </>
          }
        >
          {state?.body && <div className="text-sm text-ink-2">{state.body}</div>}
          {state?.input && (
            <div className="mt-3">
              <Field label={state.input.label} htmlFor={inputId}>
                <Textarea
                  id={inputId}
                  value={value}
                  placeholder={state.input.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                />
              </Field>
            </div>
          )}
        </Modal>
        <div
          className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
              style={{
                background: t.tone === 'error' ? 'var(--danger)' : 'var(--ink)',
                color: 'var(--bg)',
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

/** Clipboard API where available; the older execCommand route for phones and in-app browsers without it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = 'Copy', size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={async () => {
        if (await copyText(text)) toast('Copied');
        else toast('Could not copy. Select the text and copy it manually.', 'error');
      }}
    >
      <Copy className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

// WhatsApp green, deepened from #128C4B (4.3:1) to meet 4.5:1 with white text.
const WHATSAPP_GREEN = '#0F7A41';

export function WhatsAppButton({ href, label = 'WhatsApp', size = 'sm' }: { href: string; label?: string; size?: 'sm' | 'md' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white hover:opacity-90',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-4',
      )}
      style={{ background: WHATSAPP_GREEN }}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}

/** Opens the phone's own SMS app with the message ready (see smsLink). */
export function SmsButton({ href, label = 'SMS', size = 'sm' }: { href: string; label?: string; size?: 'sm' | 'md' }) {
  return (
    <a
      href={href}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface font-semibold text-brand hover:bg-surface-2',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-4',
      )}
    >
      <Smartphone className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}

export { cx };
