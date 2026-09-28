import { useEffect, useRef, useState } from 'react';
import { KeyRound, LayoutDashboard, UserPlus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandBar, Footer } from '../components/Brand';
import { Alert, Button, Card, TextField } from '../components/ui';
import { api, session } from '../lib/api';

export default function Home() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = session.chair();
  const tried = useRef(false);

  async function signIn(c: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.pub.post<{ role: 'district' | 'local'; token: string; name: string }>('/access', { code: c });
      session.setChair(r);
      nav(r.role === 'district' ? '/district' : '/local', { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Links shared on WhatsApp carry ?code=… so chairmen sign in with one tap.
  useEffect(() => {
    const c = params.get('code');
    if (c && !tried.current) {
      tried.current = true;
      setCode(c);
      window.history.replaceState(null, '', '/');
      signIn(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh">
      <BrandBar right={<Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-brand"><LayoutDashboard className="h-4 w-4" aria-hidden />Admin</Link>} />
      <main className="mx-auto max-w-lg px-4 pt-8">
        <div className="text-center">
          <img src="/gnat-logo.png" alt="GNAT Ashanti logo" className="mx-auto h-28 w-28 object-contain" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
            GNAT <span className="text-accent">Structure</span> Mapping
          </h1>
          <p className="mt-2 text-ink-2">
            Map GNAT districts, locals and basic units (workplaces) for your region.
          </p>
        </div>

        {existing && (
          <div className="mt-6">
            <Alert tone="info" title={`You are signed in as ${existing.name}`}>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => nav(existing.role === 'district' ? '/district' : '/local')}>
                  Continue
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { session.setChair(null); nav(0); }}>
                  Sign out
                </Button>
              </div>
            </Alert>
          </div>
        )}

        <Card className="mt-6" title={<span className="inline-flex items-center gap-2"><KeyRound className="h-5 w-5 text-brand" aria-hidden />Enter your access code</span>} subtitle="The code the Regional Secretary or your District Chairman sent you.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) signIn(code);
            }}
            className="space-y-4"
          >
            <TextField
              label="Access code"
              placeholder="e.g. D-7K3P-Q9XM"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck={false}
              className="code-font text-lg"
            />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" busy={busy} disabled={!code.trim()}>
              Continue
            </Button>
          </form>
        </Card>

        <Card className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">District Chairman without a code?</p>
              <p className="text-sm text-ink-3">Register your GNAT district to get one.</p>
            </div>
            <Link to="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 font-semibold text-brand hover:bg-surface-2">
              <UserPlus className="h-4 w-4" aria-hidden />
              Register district
            </Link>
          </div>
        </Card>

        <div className="mt-6 rounded-xl bg-brand-soft p-4 text-sm text-ink-2">
          <p className="font-semibold text-ink">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li><b>District Chairman</b>: confirms the political districts covered and lists the GNAT locals.</li>
            <li>Each local gets its own code. Send it to the <b>Local Chairman</b> on WhatsApp.</li>
            <li><b>Local Chairman</b>: lists the basic units / workplaces in the local.</li>
            <li>Both submit. The Regional Secretary reviews everything.</li>
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  );
}
