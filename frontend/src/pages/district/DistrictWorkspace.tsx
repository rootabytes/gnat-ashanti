import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChairShell, PoliticalPicker, StatusBanner, Stepper, StepNav, TitleRow } from '../../components/chair';
import { Alert, Button, Card, CopyButton, Empty, Field, Loading, Modal, StatusBadge, Textarea, TextField, useConfirm, useToast, WhatsAppButton } from '../../components/ui';
import { api, session } from '../../lib/api';
import { districtInviteMessage, fmtPhone, localInviteMessage, plural, whatsappLink } from '../../lib/format';
import type { DistrictDetail, LocalSummary, PoliticalDistrict } from '../../lib/types';
import { useSignedOutRedirect } from '../../lib/useSignedOut';

export default function DistrictWorkspace() {
  useSignedOutRedirect();
  const s = session.chair();
  if (!s || s.role !== 'district') return <Navigate to="/" replace />;
  return (
    <ChairShell subtitle={`${s.name} District`}>
      <DistrictFlow />
    </ChairShell>
  );
}

function DistrictFlow() {
  const confirm = useConfirm();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState<DistrictDetail | null>(null);
  const [all, setAll] = useState<PoliticalDistrict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStepState] = useState(() => Number(params.get('step') ?? -1));
  const [form, setForm] = useState({ chairName: '', chairPhone: '', chairGroup: '', remarks: '' });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [pickDirty, setPickDirty] = useState(false);

  const setStep = (i: number) => {
    setStepState(i);
    setParams(i ? { step: String(i) } : {}, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const hydrate = useCallback((x: DistrictDetail) => {
    setD(x);
    setForm({ chairName: x.chairName ?? '', chairPhone: fmtPhone(x.chairPhone), chairGroup: x.chairGroup ?? '', remarks: x.remarks ?? '' });
    setPicked(x.politicalDistricts.map((p) => p.id));
    setPickDirty(false);
  }, []);

  useEffect(() => {
    api.chair.get<DistrictDetail>('/district/me').then(
      async (x) => {
        hydrate(x);
        setAll(await api.pub.get<PoliticalDistrict[]>(`/regions/${x.regionId}/political-districts`));
        setStepState((cur) => {
          if (cur >= 0) return cur;
          if (!x.politicalDistricts.length) return x.chairName && x.chairPhone ? 1 : 0;
          if (!x.locals.length) return 2;
          return x.status === 'submitted' || x.status === 'approved' ? 3 : 2;
        });
      },
      (e) => setError(e.message),
    );
  }, [hydrate]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d || step < 0) return <Loading />;

  const editable = d.status === 'draft' || d.status === 'returned';
  const detailsDone = !!(d.chairName && d.chairPhone);
  const steps = [
    { label: 'Chairman', done: detailsDone },
    { label: 'Political districts', done: d.politicalDistricts.length > 0 },
    { label: 'Locals', done: d.locals.length > 0 },
    { label: 'Review & submit', done: d.status === 'submitted' || d.status === 'approved' },
  ];

  async function saveDetails() {
    setFormErr(null);
    setBusy(true);
    try {
      hydrate(
        await api.chair.patch<DistrictDetail>('/district/me', {
          chairName: form.chairName,
          chairPhone: form.chairPhone,
          chairGroup: form.chairGroup || null,
          remarks: form.remarks || null,
        }),
      );
      setStep(1);
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePolitical(next: number) {
    if (!pickDirty) return setStep(next);
    setBusy(true);
    try {
      hydrate(await api.chair.put<DistrictDetail>('/district/political-districts', { ids: picked }));
      toast('Saved');
      setStep(next);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const pending = d!.locals.filter((l) => l.status === 'draft' || l.status === 'returned').length;
    const { ok } = await confirm({
      title: 'Submit district?',
      body: (
        <>
          <p>
            You are submitting <b>{d!.name}</b> with {plural(d!.politicalDistricts.length, 'political district')} and {plural(d!.locals.length, 'local')}.
          </p>
          {pending > 0 && (
            <p className="mt-2">
              {plural(pending, 'local')} {pending === 1 ? 'has' : 'have'} not submitted workplaces yet. That's fine: they can still submit after you.
            </p>
          )}
        </>
      ),
      confirm: 'Submit',
    });
    if (!ok) return;
    setBusy(true);
    try {
      hydrate(await api.chair.post<DistrictDetail>('/district/submit'));
      toast('District submitted. Thank you!');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    const { ok } = await confirm({ title: 'Reopen for changes?', body: 'Your district goes back to “In progress”. Submit again when you are done.', confirm: 'Reopen' });
    if (!ok) return;
    try {
      hydrate(await api.chair.post<DistrictDetail>('/district/reopen'));
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <TitleRow title={`${d.name} District`} status={d.status}>
        <p className="text-sm text-ink-3">GNAT {d.regionName} Region</p>
      </TitleRow>
      <div className="space-y-4">
        <StatusBanner status={d.status} adminNote={d.adminNote} what="district" onReopen={reopen} />
        <Stepper steps={steps} current={step} onSelect={(i) => (step === 1 && pickDirty ? savePolitical(i) : setStep(i))} />

        {step === 0 && (
          <Card title="District Chairman" subtitle="Your contact details, so the Regional Secretary can reach you.">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveDetails(); }}>
              <TextField label="Full name" value={form.chairName} onChange={(e) => setForm({ ...form, chairName: e.target.value })} required autoComplete="name" />
              <TextField label="Phone number" type="tel" inputMode="tel" placeholder="024 123 4567" value={form.chairPhone} onChange={(e) => setForm({ ...form, chairPhone: e.target.value })} required autoComplete="tel" />
              <TextField label="Name / group (optional)" hint="e.g. District Executive Committee" value={form.chairGroup} onChange={(e) => setForm({ ...form, chairGroup: e.target.value })} />
              <Field label="Remarks (optional)" htmlFor="dremarks">
                <Textarea id="dremarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </Field>
              {formErr && <Alert tone="error">{formErr}</Alert>}
              <MyCode d={d} />
              <StepNav onNext={saveDetails} nextLabel="Save & continue" nextBusy={busy} />
            </form>
          </Card>
        )}

        {step === 1 && (
          <Card
            title="01 · Political administrative district(s)"
            subtitle={`Which political districts does ${d.name} GNAT district cover? One GNAT district may cover several (for example, Dormaa covers Dormaa Central, East and West).`}
          >
            <PoliticalPicker
              all={all}
              selected={picked}
              disabled={!editable}
              onChange={(ids) => {
                setPicked(ids);
                setPickDirty(true);
              }}
            />
            <StepNav onBack={() => savePolitical(0)} onNext={() => savePolitical(2)} nextLabel={pickDirty ? 'Save & continue' : 'Next'} nextBusy={busy} nextDisabled={editable && !picked.length} />
          </Card>
        )}

        {step === 2 && <LocalsStep d={d} editable={editable} onChange={hydrate} onBack={() => setStep(1)} onNext={() => setStep(3)} />}

        {step === 3 && (
          <Card title="Review & submit">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-3">District Chairman</dt>
                <dd className="font-semibold text-ink">{d.chairName || <span className="text-danger">Missing</span>}</dd>
                <dd className="text-ink-2">{fmtPhone(d.chairPhone)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Political district(s)</dt>
                <dd className="font-semibold text-ink">{d.politicalDistricts.map((p) => p.name).join(', ') || <span className="text-danger">None selected</span>}</dd>
              </div>
            </dl>
            <h3 className="mt-5 mb-2 font-bold text-ink">GNAT Locals ({d.locals.length})</h3>
            {d.locals.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {d.locals.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-medium text-ink">{l.name}</span>
                    <span className="flex items-center gap-2 text-ink-3">
                      {plural(l.unitCount, 'workplace')} <StatusBadge status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Alert tone="warn">No locals added yet.</Alert>
            )}
            {editable && (!detailsDone || !d.politicalDistricts.length || !d.locals.length) && (
              <div className="mt-4">
                <Alert tone="warn" title="Not ready yet">
                  {!detailsDone && <p>Add your name and phone number (step 1).</p>}
                  {!d.politicalDistricts.length && <p>Select at least one political district (step 2).</p>}
                  {!d.locals.length && <p>Add at least one local (step 3).</p>}
                </Alert>
              </div>
            )}
            <StepNav
              onBack={() => setStep(2)}
              onNext={editable ? submit : undefined}
              nextLabel="Submit district"
              nextBusy={busy}
              nextDisabled={!detailsDone || !d.politicalDistricts.length || !d.locals.length}
            />
          </Card>
        )}
      </div>
    </>
  );
}

function MyCode({ d }: { d: DistrictDetail }) {
  if (!d.code) return null;
  return (
    <div className="rounded-lg bg-brand-soft p-3 text-sm">
      <p className="text-ink-2">
        Your district access code: <b className="code-font text-brand">{d.code}</b>
      </p>
      <p className="mt-1 text-xs text-ink-3">Use it to continue on another phone. Keep it private.</p>
      <div className="mt-2 flex gap-2">
        <CopyButton text={d.code} />
        <WhatsAppButton href={whatsappLink(districtInviteMessage(d.name, d.code), d.chairPhone)} label="Send to me" />
      </div>
    </div>
  );
}

function LocalsStep({ d, editable, onChange, onBack, onNext }: { d: DistrictDetail; editable: boolean; onChange: (d: DistrictDetail) => void; onBack: () => void; onNext: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: '', chairName: '', chairPhone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalSummary | null>(null);
  const [sharing, setSharing] = useState<LocalSummary | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const next = await api.chair.post<DistrictDetail>('/district/locals', {
        name: form.name,
        chairName: form.chairName || null,
        chairPhone: form.chairPhone || null,
      });
      onChange(next);
      const created = next.locals.find((l) => l.name.toLowerCase() === form.name.trim().replace(/\s+/g, ' ').toLowerCase());
      setForm({ name: '', chairName: '', chairPhone: '' });
      toast(`${created?.name ?? 'Local'} added`);
      if (created) setSharing(created);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const done = d.locals.filter((l) => l.status === 'submitted' || l.status === 'approved').length;

  return (
    <Card
      title="02 · GNAT Locals"
      subtitle="Add every GNAT local in this district. Each local gets its own access code for its Local Chairman to list the workplaces (step 03)."
    >
      {editable && (
        <form onSubmit={add} className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-3 sm:p-4">
          <TextField label="Local name" placeholder="e.g. Ayalolo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Local Chairman (optional)" value={form.chairName} onChange={(e) => setForm({ ...form, chairName: e.target.value })} />
            <TextField label="Chairman phone (optional)" type="tel" inputMode="tel" placeholder="024 123 4567" value={form.chairPhone} onChange={(e) => setForm({ ...form, chairPhone: e.target.value })} />
          </div>
          {err && <Alert tone="error">{err}</Alert>}
          <Button type="submit" busy={busy} disabled={form.name.trim().length < 2}>
            + Add local
          </Button>
        </form>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="font-semibold text-ink">{plural(d.locals.length, 'local')}</p>
        {d.locals.length > 0 && <p className="text-ink-3">{done} of {d.locals.length} submitted workplaces</p>}
      </div>

      {d.locals.length === 0 ? (
        <div className="mt-2"><Empty title="No locals yet">Add the first local above.</Empty></div>
      ) : (
        <ul className="mt-2 space-y-2">
          {d.locals.map((l) => (
            <li key={l.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{l.name}</p>
                  <p className="text-sm text-ink-3">
                    {l.chairName ? `${l.chairName}${l.chairPhone ? ` · ${fmtPhone(l.chairPhone)}` : ''}` : 'No chairman yet'} · {plural(l.unitCount, 'workplace')}
                  </p>
                  {l.status === 'returned' && l.adminNote && <p className="mt-1 text-sm text-[var(--st-returned)]">Returned: “{l.adminNote}”</p>}
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSharing(l)}>
                  Share code
                </Button>
                <Link to={`/district/locals/${l.id}`} className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-2">
                  {l.status === 'draft' || l.status === 'returned' ? 'Fill workplaces' : 'View workplaces'}
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                  Edit
                </Button>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={async () => {
                      const { ok } = await confirm({
                        title: `Delete ${l.name}?`,
                        body: l.unitCount ? `Its ${plural(l.unitCount, 'workplace')} will also be deleted. This cannot be undone.` : 'This cannot be undone.',
                        confirm: 'Delete',
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        onChange(await api.chair.del<DistrictDetail>(`/district/locals/${l.id}`));
                      } catch (e: any) {
                        toast(e.message, 'error');
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ShareLocalModal local={sharing} district={d} onClose={() => setSharing(null)} onChange={(x) => { onChange(x); setSharing(x.locals.find((l) => l.id === sharing?.id) ?? null); }} />
      <EditLocalModal local={editing} canRename={editable} onClose={() => setEditing(null)} onSaved={(x) => { onChange(x); setEditing(null); }} />

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Review →" />
    </Card>
  );
}

function ShareLocalModal({ local, district, onClose, onChange }: { local: LocalSummary | null; district: DistrictDetail; onClose: () => void; onChange: (d: DistrictDetail) => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  if (!local) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const msg = local.code ? localInviteMessage(local.name, district.name, local.code) : '';
  return (
    <Modal open onClose={onClose} title={`Send ${local.name} its code`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-2">Send this to the Local Chairman. The link opens their form directly.</p>
        <div className="rounded-xl border-2 border-dashed border-brand bg-brand-soft p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Access code</p>
          <p className="code-font mt-1 text-2xl font-extrabold text-brand">{local.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton size="md" href={whatsappLink(msg, local.chairPhone)} label={local.chairPhone ? `WhatsApp ${fmtPhone(local.chairPhone)}` : 'Share on WhatsApp'} />
          <CopyButton size="md" text={msg} label="Copy message" />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink-2">Code shared with the wrong person?</summary>
          <p className="mt-2 text-ink-3">Make a new code. The old one stops working immediately.</p>
          <Button
            size="sm"
            variant="danger"
            className="mt-2"
            onClick={async () => {
              const { ok } = await confirm({ title: 'Make a new code?', body: 'The old code and any phone signed in with it will stop working.', confirm: 'Make new code', danger: true });
              if (!ok) return;
              try {
                onChange(await api.chair.post<DistrictDetail>(`/district/locals/${local.id}/reset-code`));
                toast('New code created');
              } catch (e: any) {
                toast(e.message, 'error');
              }
            }}
          >
            Make a new code
          </Button>
        </details>
      </div>
    </Modal>
  );
}

function EditLocalModal({ local, canRename, onClose, onSaved }: { local: LocalSummary | null; canRename: boolean; onClose: () => void; onSaved: (d: DistrictDetail) => void }) {
  const [f, setF] = useState({ name: '', chairName: '', chairPhone: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (local) setF({ name: local.name, chairName: local.chairName ?? '', chairPhone: fmtPhone(local.chairPhone) });
    setErr(null);
  }, [local]);
  return (
    <Modal
      open={!!local}
      onClose={onClose}
      title={`Edit ${local?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const body: Record<string, unknown> = { chairName: f.chairName || null, chairPhone: f.chairPhone || null };
                if (canRename && f.name !== local!.name) body.name = f.name;
                onSaved(await api.chair.patch<DistrictDetail>(`/district/locals/${local!.id}`, body));
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Local name" value={f.name} disabled={!canRename} onChange={(e) => setF({ ...f, name: e.target.value })} hint={!canRename ? 'Reopen the district to rename a local.' : undefined} />
        <TextField label="Local Chairman" value={f.chairName} onChange={(e) => setF({ ...f, chairName: e.target.value })} />
        <TextField label="Chairman phone" type="tel" inputMode="tel" value={f.chairPhone} onChange={(e) => setF({ ...f, chairPhone: e.target.value })} />
        {err && <Alert tone="error">{err}</Alert>}
      </div>
    </Modal>
  );
}
