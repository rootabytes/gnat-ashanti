import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StatusBanner, Stepper, StepNav, TitleRow } from '../../components/chair';
import { Alert, Button, Card, Field, Loading, Textarea, TextField, useConfirm, useToast } from '../../components/ui';
import { UnitsEditor } from '../../components/UnitsEditor';
import { api } from '../../lib/api';
import { fmtPhone } from '../../lib/format';
import type { LocalDetail, Unit } from '../../lib/types';
import { useMeta } from '../../lib/useMeta';

/**
 * The three-step local form. `base` is '/local' for the local chairman, or
 * '/district/locals/:id' when the district chairman fills it on their behalf.
 */
export function LocalFlow({ base, detailsPath, header }: { base: string; detailsPath: string | null; header?: ReactNode }) {
  const { meta } = useMeta();
  const confirm = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<LocalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ chairName: '', chairPhone: '', remarks: '' });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unitCount, setUnitCount] = useState(0);

  const hydrate = useCallback((d: LocalDetail) => {
    setData(d);
    setUnitCount(d.units.length);
    setForm({ chairName: d.chairName ?? '', chairPhone: fmtPhone(d.chairPhone), remarks: d.remarks ?? '' });
  }, []);

  useEffect(() => {
    api.chair.get<LocalDetail>(base === '/local' ? '/local/me' : base).then(
      (d) => {
        hydrate(d);
        // Returning users land where the work is.
        if (d.chairName && d.chairPhone) setStep(d.status === 'draft' || d.status === 'returned' ? 1 : 2);
      },
      (e) => setError(e.message),
    );
  }, [base, hydrate]);

  const save = useCallback(
    async (units: Unit[]) => {
      const d = await api.chair.put<LocalDetail>(`${base}/units`, { units });
      setData((prev) => (prev ? { ...prev, units: d.units, updatedAt: d.updatedAt } : d));
      return d.units;
    },
    [base],
  );

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !meta) return <Loading />;

  const editable = data.status === 'draft' || data.status === 'returned';
  const detailsDone = !!(data.chairName && data.chairPhone);
  const steps = [
    { label: 'Chairman', done: detailsDone },
    { label: 'Workplaces', done: unitCount > 0 },
    { label: 'Review & submit', done: data.status === 'submitted' || data.status === 'approved' },
  ];

  async function saveDetails(): Promise<boolean> {
    setFormErr(null);
    setBusy(true);
    try {
      const body = { chairName: form.chairName, chairPhone: form.chairPhone, remarks: form.remarks || null };
      const d =
        detailsPath === null
          ? await api.chair.patch<LocalDetail>('/local/me', body)
          : (await api.chair.patch(detailsPath, body), await api.chair.get<LocalDetail>(base));
      hydrate(d);
      return true;
    } catch (e: any) {
      setFormErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const { ok } = await confirm({
      title: 'Submit this local?',
      body: `You are submitting ${unitCount} workplace${unitCount === 1 ? '' : 's'} for ${data!.name}. The list will be locked while the Regional Secretary reviews it.`,
      confirm: 'Submit',
    });
    if (!ok) return;
    setBusy(true);
    try {
      hydrate(await api.chair.post<LocalDetail>(`${base}/submit`));
      toast('Submitted. Thank you!');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    const { ok } = await confirm({ title: 'Reopen for changes?', body: 'The list will go back to “In progress”. Remember to submit again when you finish.', confirm: 'Reopen' });
    if (!ok) return;
    try {
      hydrate(await api.chair.post<LocalDetail>(`${base}/reopen`));
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      {header}
      <TitleRow title={`${data.name} Local`} status={data.status}>
        <p className="text-sm text-ink-3">
          {data.districtName} District · {data.regionName} Region
        </p>
      </TitleRow>
      <div className="space-y-4">
        <StatusBanner status={data.status} adminNote={data.adminNote} what="local" onReopen={reopen} />
        <Stepper steps={steps} current={step} onSelect={setStep} />

        {step === 0 && (
          <Card title="Local Chairman" subtitle="Who is responsible for this local?">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await saveDetails()) setStep(1);
              }}
            >
              <TextField label="Full name" value={form.chairName} onChange={(e) => setForm({ ...form, chairName: e.target.value })} required autoComplete="name" />
              <TextField label="Phone number" type="tel" inputMode="tel" placeholder="024 123 4567" value={form.chairPhone} onChange={(e) => setForm({ ...form, chairPhone: e.target.value })} required autoComplete="tel" />
              <Field label="Remarks (optional)" htmlFor="remarks" hint="Anything the Regional Secretary should know about this local.">
                <Textarea id="remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </Field>
              {formErr && <Alert tone="error">{formErr}</Alert>}
              <StepNav onNext={async () => { if (await saveDetails()) setStep(1); }} nextLabel="Save & continue" nextBusy={busy} />
            </form>
          </Card>
        )}

        {step === 1 && (
          <Card
            title="Basic units / workplaces"
            subtitle="List every school, office or institution where members of this local work, and choose its category."
          >
            <UnitsEditor
              units={data.units}
              categories={meta.categories}
              editable={editable}
              storageKey={`gnat.draft.local.${data.id}`}
              save={save}
              onChange={(u) => setUnitCount(u.length)}
            />
            <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Review →" />
          </Card>
        )}

        {step === 2 && (
          <Card title="Review & submit">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-3">Local Chairman</dt>
                <dd className="font-semibold text-ink">{data.chairName || <span className="text-danger">Missing</span>}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Phone</dt>
                <dd className="font-semibold text-ink">{fmtPhone(data.chairPhone) || <span className="text-danger">Missing</span>}</dd>
              </div>
            </dl>
            <h3 className="mt-5 mb-2 font-bold text-ink">Workplaces ({data.units.length})</h3>
            {data.units.length ? (
              <ol className="list-decimal space-y-1 pl-6 text-sm">
                {data.units.map((u, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{u.name}</span> <span className="text-ink-3">· {u.category}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Alert tone="warn">No workplaces added yet.</Alert>
            )}
            {editable && (!detailsDone || !data.units.length) && (
              <div className="mt-4">
                <Alert tone="warn" title="Not ready yet">
                  {!detailsDone && <p>Add the chairman's name and phone number (step 1).</p>}
                  {!data.units.length && <p>Add at least one workplace (step 2).</p>}
                </Alert>
              </div>
            )}
            <StepNav
              onBack={() => setStep(1)}
              onNext={editable ? submit : undefined}
              nextLabel="Submit local"
              nextBusy={busy}
              nextDisabled={!detailsDone || !data.units.length}
              extra={!editable && data.status === 'submitted' ? <Button variant="secondary" onClick={reopen}>Reopen</Button> : undefined}
            />
          </Card>
        )}
      </div>
    </>
  );
}
