import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CopyButton,
  Modal,
  Select,
  SmsButton,
  TextField,
  useConfirm,
  useToast,
  WhatsAppButton,
} from '../../components/ui';
import { api, session } from '../../lib/api';
import { adminInviteMessage, fmtDate, fmtPhone, smsLink, timeAgo, whatsappLink } from '../../lib/format';
import { useAdmin } from './AdminApp';

// Admin accounts. The super admin (no region) adds admins with their WhatsApp number;
// the system makes a temporary password that the super admin sends them from their own
// WhatsApp. At first sign-in (with the phone number) the new admin must add their email
// and choose their own password before anything else opens.

interface Profile {
  name: string;
  email: string;
  phone: string;
}

const fromMe = (me: { name: string; email: string | null; phone: string | null }): Profile => ({
  name: me.name,
  email: me.email ?? '',
  phone: fmtPhone(me.phone),
});

async function saveProfile(p: Profile) {
  const r = await api.admin.patch<{ token: string; name: string; email: string }>('/admin/me', {
    name: p.name,
    email: p.email || undefined,
    phone: p.phone || null,
  });
  session.setAdmin(r);
}

function ProfileFields({ p, set, emailHint }: { p: Profile; set: (p: Profile) => void; emailHint?: string }) {
  return (
    <>
      <TextField label="Your name" value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} required autoComplete="name" />
      <TextField
        label="Email"
        type="email"
        value={p.email}
        onChange={(e) => set({ ...p, email: e.target.value })}
        required
        autoComplete="email"
        hint={emailHint}
      />
      <TextField
        label="Phone number (WhatsApp)"
        type="tel"
        inputMode="tel"
        value={p.phone}
        onChange={(e) => set({ ...p, phone: e.target.value })}
        autoComplete="tel"
        hint="You can also sign in with it."
      />
    </>
  );
}

/** First sign-in with a temporary password: add your email and choose your own password. */
export function AccountSetup({ onDone }: { onDone: () => void }) {
  const { me } = useAdmin();
  const [p, setP] = useState<Profile>(fromMe(me));
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card
      title="Set up your account"
      subtitle="You signed in with a temporary password. Add your email and choose your own password; the temporary one then stops working."
    >
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (pw.next !== pw.again) return setErr('The new passwords do not match.');
          setBusy(true);
          try {
            await saveProfile(p);
            await api.admin.post('/admin/password', { current: pw.current, next: pw.next });
            onDone();
          } catch (e: any) {
            setErr(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ProfileFields p={p} set={setP} emailHint="You will sign in with this email from now on." />
        <TextField
          label="Temporary password"
          type="password"
          autoComplete="current-password"
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
          required
          hint="The one you were sent."
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
          required
          minLength={10}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={pw.again}
          onChange={(e) => setPw({ ...pw, again: e.target.value })}
          required
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" className="justify-self-start" busy={busy}>
          Save and continue
        </Button>
      </form>
    </Card>
  );
}

/** Settings → Your account: details and password. */
export function AccountCard() {
  const { me, reloadMe } = useAdmin();
  const toast = useToast();
  const [p, setP] = useState<Profile>(fromMe(me));
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [err, setErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  if (me.demo) {
    return (
      <Card title="Your account">
        <Alert tone="info">Demo accounts keep their published sign-in details so every tester can use them.</Alert>
      </Card>
    );
  }
  return (
    <Card
      title="Your account"
      subtitle={
        me.region_id === null
          ? 'Super admin: manages admins and the system, and can open any region to support it (recorded in that region’s activity log).'
          : `Admin for the ${me.regions[0]?.name} Region.`
      }
    >
      <form
        className="grid max-w-md gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await saveProfile(p);
            await reloadMe();
            toast('Details saved');
          } catch (e: any) {
            setErr(e.message);
          }
        }}
      >
        <ProfileFields p={p} set={setP} />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" variant="secondary" className="justify-self-start">
          Save details
        </Button>
      </form>

      <form
        className="mt-6 grid max-w-md gap-3 border-t border-line pt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPwErr(null);
          if (pw.next !== pw.again) return setPwErr('The new passwords do not match.');
          try {
            await api.admin.post('/admin/password', { current: pw.current, next: pw.next });
            setPw({ current: '', next: '', again: '' });
            toast('Password changed');
          } catch (e: any) {
            setPwErr(e.message);
          }
        }}
      >
        <p className="font-semibold text-ink">Change your password</p>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
          required
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
          required
          minLength={10}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={pw.again}
          onChange={(e) => setPw({ ...pw, again: e.target.value })}
          required
        />
        {pwErr && <Alert tone="error">{pwErr}</Alert>}
        <Button type="submit" className="justify-self-start">
          Change password
        </Button>
      </form>
    </Card>
  );
}

interface AdminRow {
  id: number;
  email: string | null;
  phone: string | null;
  name: string;
  region_id: number | null;
  region_name: string | null;
  region_code: string | null;
  last_login_at: string | null;
  must_change_password: boolean;
  password_expires_at: string | null;
}
type Issued = AdminRow & { tempPassword: string };

/** Settings → Admins (super admin only). */
export function AdminsCard() {
  const { me } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const defaultRegion = String(me.regions.find((r) => r.active)?.id ?? '');
  const [f, setF] = useState({ name: '', phone: '', regionId: defaultRegion });
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const isSuper = me.region_id === null;

  useEffect(() => {
    if (isSuper) api.admin.get<AdminRow[]>('/admin/admins').then(setRows, () => setRows([]));
  }, [isSuper]);

  if (!isSuper) return null;

  const upsert = (row: AdminRow) => setRows((rs) => [...(rs ?? []).filter((r) => r.id !== row.id), row]);

  return (
    <Card
      title="Admins"
      subtitle="People who can open this dashboard. A regional admin sees and manages only their region's data. The super admin manages admins and the system, and can open any region; each time, that region's activity log records it."
    >
      {rows && (
        <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                  {a.region_id === null && <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />}
                  {a.name}
                  {a.id === me.id && <span className="font-normal text-ink-3">(you)</span>}
                </p>
                <p className="text-ink-3">
                  {[a.email, fmtPhone(a.phone)].filter(Boolean).join(' · ')} · {a.region_name ? `${a.region_name} only` : 'Super admin'}
                </p>
                <p className="text-xs text-ink-3">
                  {a.must_change_password
                    ? `Has not set up the account yet${a.password_expires_at ? `. Temporary password expires ${fmtDate(a.password_expires_at)}` : ''}`
                    : a.last_login_at
                      ? `Last signed in ${timeAgo(a.last_login_at)}`
                      : 'Never signed in'}
                </p>
              </div>
              {a.id !== me.id && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const { ok } = await confirm({
                        title: `New temporary password for ${a.name}?`,
                        body: 'Their current password stops working. They sign in with the new one and choose their own again.',
                        confirm: 'Make new password',
                      });
                      if (!ok) return;
                      try {
                        const r = await api.admin.post<Issued>(`/admin/admins/${a.id}/reset-password`);
                        upsert(r);
                        setIssued(r);
                      } catch (e: any) {
                        toast(e.message, 'error');
                      }
                    }}
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                    New password
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    aria-label={`Remove ${a.name}`}
                    onClick={async () => {
                      const { ok } = await confirm({
                        title: `Remove ${a.name}?`,
                        body: 'They will no longer be able to sign in. Their past changes stay in the activity log.',
                        confirm: 'Remove',
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        await api.admin.del(`/admin/admins/${a.id}`);
                        setRows((rs) => (rs ?? []).filter((r) => r.id !== a.id));
                        toast('Admin removed');
                      } catch (e: any) {
                        toast(e.message, 'error');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mb-3 font-semibold text-ink">Add an admin</p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api.admin.post<Issued>('/admin/admins', {
              name: f.name,
              phone: f.phone,
              regionId: f.regionId ? Number(f.regionId) : null,
            });
            upsert(r);
            setIssued(r);
            setF({ name: '', phone: '', regionId: defaultRegion });
          } catch (err: any) {
            toast(err.message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField
          label="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
          placeholder="e.g. Assistant Regional Secretary"
        />
        <TextField
          label="WhatsApp number"
          type="tel"
          inputMode="tel"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
          required
          placeholder="024 123 4567"
          hint="They sign in with it first, then add their own email."
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-ink" htmlFor="admin-region">
            Access
          </label>
          <Select id="admin-region" value={f.regionId} onChange={(e) => setF({ ...f, regionId: e.target.value })}>
            {me.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} Region only
              </option>
            ))}
            <option value="">Super admin (admins, system, and every region, logged)</option>
          </Select>
        </div>
        <Button type="submit" className="self-end justify-self-start" busy={busy}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Add admin
        </Button>
      </form>

      <SendSignIn issued={issued} onClose={() => setIssued(null)} />
    </Card>
  );
}

/** Shown once: the temporary password, ready to send from the super admin's own WhatsApp or SMS. */
function SendSignIn({ issued, onClose }: { issued: Issued | null; onClose: () => void }) {
  if (!issued) return null;
  const access = issued.region_name ? `${issued.region_name} Region` : 'the system (super admin)';
  const msg = adminInviteMessage(issued.name, access, issued.phone, issued.tempPassword, issued.region_code);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Send ${issued.name} their sign-in details`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <Alert tone="warn">
          This temporary password is shown only now. Send it, then close this window. It works for 7 days and only until they choose their
          own.
        </Alert>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
          <dt className="text-ink-3">Sign in with</dt>
          <dd className="font-semibold text-ink">{fmtPhone(issued.phone) || issued.email}</dd>
          <dt className="text-ink-3">Temporary password</dt>
          <dd className="code-font text-lg font-extrabold text-brand">{issued.tempPassword}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton size="md" href={whatsappLink(msg, issued.phone)} label={`WhatsApp ${fmtPhone(issued.phone)}`} />
          <SmsButton size="md" href={smsLink(msg, issued.phone)} />
          <CopyButton size="md" text={msg} label="Copy message" />
        </div>
      </div>
    </Modal>
  );
}
