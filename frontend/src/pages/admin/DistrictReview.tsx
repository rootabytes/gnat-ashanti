import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, CheckCheck, CheckCircle2, ChevronDown, LockOpen, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CopyButton,
  Loading,
  StatusBadge,
  TextField,
  useConfirm,
  useToast,
  SmsButton,
  WhatsAppButton,
} from '../../components/ui';
import { GpsTag } from '../../components/UnitsEditor';
import { api } from '../../lib/api';
import { districtInviteMessage, fmtDate, fmtPhone, localInviteMessage, plural, smsLink, whatsappLink } from '../../lib/format';
import type { DistrictDetail, LocalSummary } from '../../lib/types';
import { useMeta } from '../../lib/useMeta';

export default function DistrictReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { meta } = useMeta();
  const [d, setD] = useState<DistrictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.admin.get<DistrictDetail>(`/admin/districts/${id}`).then(setD, (e) => setError(e.message));
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d) return <Loading />;

  const run = async (fn: () => Promise<DistrictDetail>, msg: string) => {
    try {
      setD(await fn());
      toast(msg);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const setStatus = async (
    target: 'district' | 'local',
    entity: { id: number; name: string },
    status: 'approved' | 'returned' | 'draft',
  ) => {
    const path = target === 'district' ? `/admin/districts/${entity.id}/status` : `/admin/locals/${entity.id}/status`;
    if (status === 'returned') {
      const r = await confirm({
        title: `Return ${entity.name} for correction`,
        body: 'The chairman will see your note and can edit and resubmit.',
        input: { label: 'What needs correcting?', required: true, placeholder: 'e.g. Please add the missing locals in Suame.' },
        confirm: 'Return',
      });
      if (!r.ok) return;
      return run(() => api.admin.post(path, { status, note: r.value }), `${entity.name} returned`);
    }
    if (status === 'draft') {
      const { ok } = await confirm({
        title: `Reopen ${entity.name}?`,
        body: 'It goes back to “In progress” so the chairman can edit it.',
        confirm: 'Reopen',
      });
      if (!ok) return;
    }
    return run(() => api.admin.post(path, { status }), status === 'approved' ? `${entity.name} approved` : `${entity.name} reopened`);
  };

  const catLabel = (v: string) => meta?.categories.find((c) => c.value === v)?.label ?? v;
  const submittedLocals = d.locals.filter((l) => l.status === 'submitted').length;

  return (
    <div className="space-y-5">
      <Link to="/admin/districts" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All districts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{d.name} District</h1>
          <p className="text-sm text-ink-3">
            Registered {fmtDate(d.createdAt)}
            {d.submittedAt && ` · Submitted ${fmtDate(d.submittedAt, true)}`}
            {!d.verified && ' · Self-registered'}
          </p>
        </div>
        <StatusBadge status={d.status} />
      </div>

      {d.status === 'returned' && d.adminNote && (
        <Alert tone="warn" title="Returned with note">
          “{d.adminNote}”
        </Alert>
      )}

      <Card title="Review actions">
        <div className="flex flex-wrap gap-2">
          {d.status === 'submitted' && (
            <>
              <Button onClick={() => setStatus('district', d, 'approved')}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Approve district
              </Button>
              {submittedLocals > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => run(() => api.admin.post(`/admin/districts/${d.id}/approve-all`), 'District and locals approved')}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden />
                  Approve district + {plural(submittedLocals, 'submitted local')}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setStatus('district', d, 'returned')}>
                <Undo2 className="h-4 w-4" aria-hidden />
                Return for correction
              </Button>
            </>
          )}
          {(d.status === 'approved' || d.status === 'submitted') && (
            <Button variant="ghost" onClick={() => setStatus('district', d, 'draft')}>
              <LockOpen className="h-4 w-4" aria-hidden />
              Reopen for editing
            </Button>
          )}
          {(d.status === 'draft' || d.status === 'returned') && (
            <p className="text-sm text-ink-3">Waiting for the district chairman to submit.</p>
          )}
          {!d.verified && (
            <Button
              variant="secondary"
              onClick={() => run(() => api.admin.patch(`/admin/districts/${d.id}`, { verified: true }), 'Marked as verified')}
            >
              <BadgeCheck className="h-4 w-4" aria-hidden />
              Mark as genuine
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="District Chairman"
          action={
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Close' : 'Edit'}
            </Button>
          }
        >
          {editing ? (
            <EditDistrict
              d={d}
              onSaved={(x) => {
                setD(x);
                setEditing(false);
                toast('Saved');
              }}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-ink-3">Name</dt>
                <dd className="font-semibold">{d.chairName ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Phone</dt>
                <dd className="font-semibold">{fmtPhone(d.chairPhone) || '-'}</dd>
              </div>
              {d.chairGroup && (
                <div>
                  <dt className="text-ink-3">Name / group</dt>
                  <dd className="font-semibold">{d.chairGroup}</dd>
                </div>
              )}
              {d.remarks && (
                <div>
                  <dt className="text-ink-3">Remarks</dt>
                  <dd className="whitespace-pre-wrap">{d.remarks}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>
        <Card title="Access code">
          <p className="code-font text-2xl font-extrabold text-brand">{d.code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={d.code ?? ''} />
            {d.code && <WhatsAppButton href={whatsappLink(districtInviteMessage(d.name, d.code), d.chairPhone)} label="Send to chairman" />}
            {d.code && <SmsButton href={smsLink(districtInviteMessage(d.name, d.code), d.chairPhone)} />}
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                const { ok } = await confirm({
                  title: 'Reset district code?',
                  body: 'The old code stops working and the chairman is signed out.',
                  confirm: 'Reset',
                  danger: true,
                });
                if (ok) run(() => api.admin.post(`/admin/districts/${d.id}/reset-code`), 'New code created');
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset code
            </Button>
          </div>
        </Card>
      </div>

      <Card title={`01 · Political administrative district(s) (${d.politicalDistricts.length})`}>
        {d.politicalDistricts.length ? (
          <div className="flex flex-wrap gap-1.5">
            {d.politicalDistricts.map((p) => (
              <span key={p.id} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-ink">
                {p.name} <span className="font-normal text-ink-3">{p.kind}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-3">None selected yet.</p>
        )}
      </Card>

      <Card
        title={`02–03 · Locals and workplaces (${d.locals.length})`}
        action={
          d.locals.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(open.size ? new Set() : new Set(d.locals.map((l) => l.id)))}>
              {open.size ? 'Collapse all' : 'Expand all'}
            </Button>
          )
        }
      >
        {d.locals.length === 0 && <p className="text-sm text-ink-3">No locals added yet.</p>}
        <ul className="space-y-2">
          {d.locals.map((l) => (
            <LocalItem
              key={l.id}
              l={l}
              districtName={d.name}
              expanded={open.has(l.id)}
              toggle={() => {
                const n = new Set(open);
                if (n.has(l.id)) n.delete(l.id);
                else n.add(l.id);
                setOpen(n);
              }}
              catLabel={catLabel}
              onStatus={(s) => setStatus('local', l, s)}
              onReset={async () => {
                const { ok } = await confirm({
                  title: `Reset code for ${l.name}?`,
                  body: 'The old code stops working immediately.',
                  confirm: 'Reset',
                  danger: true,
                });
                if (ok) run(() => api.admin.post(`/admin/locals/${l.id}/reset-code`), 'New code created');
              }}
              onDelete={async () => {
                const { ok } = await confirm({
                  title: `Delete ${l.name}?`,
                  body: `Its ${plural(l.unitCount, 'workplace')} will be deleted too. This cannot be undone.`,
                  confirm: 'Delete',
                  danger: true,
                });
                if (ok) run(() => api.admin.del(`/admin/locals/${l.id}`), `${l.name} deleted`);
              }}
            />
          ))}
        </ul>
      </Card>

      <Card title="Danger zone">
        <p className="text-sm text-ink-2">
          Delete this district with all its locals and workplaces, e.g. a duplicate or test registration.
        </p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={async () => {
            const r = await confirm({
              title: `Delete ${d.name}?`,
              body: `This permanently deletes the district, ${plural(d.locals.length, 'local')} and all their workplaces. Type the district name to confirm.`,
              input: { label: 'District name', required: true },
              confirm: 'Delete permanently',
              danger: true,
            });
            if (!r.ok) return;
            if (r.value.trim().toLowerCase() !== d.name.toLowerCase()) return toast('Name did not match. Nothing was deleted.', 'error');
            try {
              await api.admin.del(`/admin/districts/${d.id}`);
              toast(`${d.name} deleted`);
              nav('/admin/districts');
            } catch (e: any) {
              toast(e.message, 'error');
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete district
        </Button>
      </Card>
    </div>
  );
}

function LocalItem({
  l,
  districtName,
  expanded,
  toggle,
  catLabel,
  onStatus,
  onReset,
  onDelete,
}: {
  l: LocalSummary;
  districtName: string;
  expanded: boolean;
  toggle: () => void;
  catLabel: (v: string) => string;
  onStatus: (s: 'approved' | 'returned' | 'draft') => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-line">
      <button onClick={toggle} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block font-bold text-ink">{l.name}</span>
          <span className="block text-sm text-ink-3">
            {l.chairName ?? 'No chairman'} {l.chairPhone && `· ${fmtPhone(l.chairPhone)}`} · {plural(l.unitCount, 'workplace')}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge status={l.status} />
          <ChevronDown className={`h-4 w-4 text-ink-3 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-line px-4 py-3">
          {l.status === 'returned' && l.adminNote && <p className="mb-2 text-sm text-[var(--st-returned)]">Returned: “{l.adminNote}”</p>}
          {l.units?.length ? (
            <ol className="list-decimal space-y-0.5 pl-6 text-sm">
              {l.units.map((u, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{u.name}</span>{' '}
                  <span className="text-ink-3">
                    · {catLabel(u.category)}
                    {u.gpsAddress && <GpsTag gps={u.gpsAddress} />}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">No workplaces yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {l.status === 'submitted' && (
              <>
                <Button size="sm" onClick={() => onStatus('approved')}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onStatus('returned')}>
                  <Undo2 className="h-4 w-4" aria-hidden />
                  Return
                </Button>
              </>
            )}
            {(l.status === 'submitted' || l.status === 'approved') && (
              <Button size="sm" variant="ghost" onClick={() => onStatus('draft')}>
                Reopen
              </Button>
            )}
            {l.code && (
              <>
                <WhatsAppButton href={whatsappLink(localInviteMessage(l.name, districtName, l.code), l.chairPhone)} label="Send code" />
                <SmsButton href={smsLink(localInviteMessage(l.name, districtName, l.code), l.chairPhone)} />
              </>
            )}
            <span className="code-font text-sm text-ink-2">{l.code}</span>
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset code
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function EditDistrict({ d, onSaved }: { d: DistrictDetail; onSaved: (d: DistrictDetail) => void }) {
  const [f, setF] = useState({
    name: d.name,
    chairName: d.chairName ?? '',
    chairPhone: fmtPhone(d.chairPhone),
    chairGroup: d.chairGroup ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          onSaved(
            await api.admin.patch<DistrictDetail>(`/admin/districts/${d.id}`, {
              name: f.name,
              chairName: f.chairName || null,
              chairPhone: f.chairPhone || null,
              chairGroup: f.chairGroup || null,
            }),
          );
        } catch (e: any) {
          setErr(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label="District name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <TextField label="Chairman" value={f.chairName} onChange={(e) => setF({ ...f, chairName: e.target.value })} />
      <TextField label="Phone" type="tel" value={f.chairPhone} onChange={(e) => setF({ ...f, chairPhone: e.target.value })} />
      <TextField label="Name / group" value={f.chairGroup} onChange={(e) => setF({ ...f, chairGroup: e.target.value })} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button type="submit" busy={busy}>
        Save
      </Button>
    </form>
  );
}
