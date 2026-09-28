import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandBar, Footer } from '../components/Brand';
import { Alert, Button, Card, CopyButton, Field, Loading, Select, TextField, WhatsAppButton } from '../components/ui';
import { api, session } from '../lib/api';
import { districtInviteMessage, whatsappLink } from '../lib/format';
import { useMeta } from '../lib/useMeta';

export default function Register() {
  const nav = useNavigate();
  const { meta, error: metaError } = useMeta();
  const [form, setForm] = useState({ regionId: 0, registrationKey: '', districtName: '', chairName: '', chairPhone: '', chairGroup: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; name: string; token: string } | null>(null);

  useEffect(() => {
    if (meta && !form.regionId && meta.regions.length) setForm((f) => ({ ...f, regionId: meta.regions[0].id }));
  }, [meta, form.regionId]);

  const region = meta?.regions.find((r) => r.id === form.regionId);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.pub.post<{ token: string; code: string; name: string; role: 'district' }>('/register', {
        ...form,
        registrationKey: form.registrationKey || null,
        chairGroup: form.chairGroup || null,
      });
      setDone(r);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <BrandBar subtitle="Register a GNAT district" />
      <main className="mx-auto max-w-lg px-4 pt-6">
        {!meta && !metaError && <Loading />}
        {metaError && <Alert tone="error">{metaError}</Alert>}

        {done ? (
          <Card title="Your district is registered">
            <div className="space-y-4">
              <Alert tone="success" title={done.name}>
                Save this access code. You need it to come back and finish your form, on this phone or any other.
              </Alert>
              <div className="rounded-xl border-2 border-dashed border-brand bg-brand-soft p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Your access code</p>
                <p className="code-font mt-1 text-3xl font-extrabold text-brand">{done.code}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <CopyButton text={done.code} label="Copy code" size="md" />
                <WhatsAppButton
                  size="md"
                  label="Send to my WhatsApp"
                  href={whatsappLink(districtInviteMessage(done.name, done.code), form.chairPhone.replace(/^0/, '233'))}
                />
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  session.setChair({ role: 'district', token: done.token, name: done.name });
                  nav('/district');
                }}
              >
                Start filling the form
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </Card>
        ) : (
          meta && (
            <Card title="Register your GNAT district" subtitle="For District Chairmen. Each GNAT district registers only once.">
              <form onSubmit={submit} className="space-y-4">
                {meta.regions.length > 1 ? (
                  <Field label="GNAT Region" htmlFor="region">
                    <Select
                      id="region"
                      value={form.regionId}
                      onChange={(e) => setForm((f) => ({ ...f, regionId: Number(e.target.value) }))}
                    >
                      {meta.regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p className="text-sm text-ink-2">
                    Region: <b className="text-ink">{region?.name}</b>
                  </p>
                )}
                {region?.requiresKey && (
                  <TextField
                    label="Registration key"
                    hint="The Regional Secretary shares this in the chairmen's group."
                    value={form.registrationKey}
                    onChange={set('registrationKey')}
                    required
                    autoCapitalize="none"
                  />
                )}
                <TextField
                  label="GNAT District name"
                  placeholder="e.g. Kumasi Metro"
                  value={form.districtName}
                  onChange={set('districtName')}
                  required
                  minLength={2}
                />
                <TextField
                  label="Your full name (District Chairman)"
                  value={form.chairName}
                  onChange={set('chairName')}
                  required
                  autoComplete="name"
                />
                <TextField
                  label="Your phone number"
                  type="tel"
                  inputMode="tel"
                  placeholder="024 123 4567"
                  value={form.chairPhone}
                  onChange={set('chairPhone')}
                  required
                  autoComplete="tel"
                />
                <TextField
                  label="Name / group (optional)"
                  hint="e.g. District Executive Committee"
                  value={form.chairGroup}
                  onChange={set('chairGroup')}
                />
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
                  Your name and phone number are used only to organise the GNAT mapping exercise. The Regional Secretary sees them, and they
                  are never sold or used for advertising. Read the{' '}
                  <Link to="/privacy" className="font-semibold text-brand">
                    privacy notice
                  </Link>
                  .
                </p>
                {error && <Alert tone="error">{error}</Alert>}
                <Button type="submit" size="lg" className="w-full" busy={busy}>
                  Register and get my code
                </Button>
                <p className="text-center text-sm text-ink-3">
                  Already registered?{' '}
                  <Link to="/" className="font-semibold text-brand">
                    Enter your code
                  </Link>
                </p>
              </form>
            </Card>
          )
        )}
      </main>
      <Footer />
    </div>
  );
}
