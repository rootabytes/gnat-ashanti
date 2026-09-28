import { useEffect, useState } from 'react';
import { Alert, Button, Card, CopyButton, Loading, Select, TextField, useConfirm, useToast, WhatsAppButton } from '../../components/ui';
import { api } from '../../lib/api';
import { whatsappLink } from '../../lib/format';
import type { PoliticalDistrict } from '../../lib/types';
import { PageTitle, useAdmin } from './AdminApp';

export default function Settings() {
  return (
    <div className="space-y-5">
      <PageTitle title="Settings" />
      <RegistrationCard />
      <PoliticalCard />
      <PasswordCard />
      <AdminsCard />
    </div>
  );
}

function RegistrationCard() {
  const { region, reloadMe } = useAdmin();
  const toast = useToast();
  const [key, setKey] = useState(region.registration_key ?? '');
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/register`;
  const message =
    `GNAT ${region.name} Region: Structure Mapping\n\n` +
    `District Chairmen, please register your GNAT district and fill in the mapping form here:\n${link}\n` +
    (region.registration_key ? `\nRegistration key: ${region.registration_key}\n` : '') +
    `\nAfter registering you will get an access code. Keep it safe; you need it to continue later and to create codes for your Local Chairmen.`;

  return (
    <Card title="District registration" subtitle="District Chairmen register their GNAT district themselves using this link.">
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="text-ink-3">Registration link</p>
          <p className="break-all font-semibold text-ink">{link}</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.admin.patch(`/admin/regions/${region.id}`, { registrationKey: key.trim() || null });
              await reloadMe();
              toast(key.trim() ? 'Registration key saved' : 'Registration is now open to anyone with the link');
            } catch (err: any) {
              toast(err.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="min-w-60 flex-1">
            <TextField
              label="Registration key"
              hint="Recommended. Only people with this key can register a district. Leave empty to allow anyone with the link."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. torch2026"
            />
          </div>
          <Button type="submit" busy={busy}>Save key</Button>
        </form>
        {!region.registration_key && <Alert tone="warn">No registration key is set. Anyone who finds the link can register a district. You can delete fake ones from the district page.</Alert>}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Message for the District Chairmen WhatsApp group</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">{message}</pre>
          <div className="mt-2 flex gap-2">
            <WhatsAppButton size="md" href={whatsappLink(message)} label="Share on WhatsApp" />
            <CopyButton size="md" text={message} label="Copy message" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function PoliticalCard() {
  const { q } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState<PoliticalDistrict[] | null>(null);
  const [f, setF] = useState({ name: '', kind: 'District' });

  useEffect(() => {
    api.admin.get<PoliticalDistrict[]>(q('/admin/political-districts')).then(setList, (e) => toast(e.message, 'error'));
  }, [q, toast]);

  return (
    <Card title="Political administrative districts" subtitle="The list chairmen choose from. Pre-loaded with the region's MMDAs.">
      {!list ? (
        <Loading />
      ) : (
        <>
          <form
            className="mb-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const row = await api.admin.post<PoliticalDistrict>(q('/admin/political-districts'), f);
                setList([...list, row].sort((a, b) => a.name.localeCompare(b.name)));
                setF({ name: '', kind: 'District' });
                toast('Added');
              } catch (err: any) {
                toast(err.message, 'error');
              }
            }}
          >
            <TextField label="Add a district" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name without “Municipal/District”" />
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Type">
              <option>District</option>
              <option>Municipal</option>
              <option>Metropolitan</option>
            </Select>
            <Button type="submit" disabled={f.name.trim().length < 2}>Add</Button>
          </form>
          <p className="mb-2 text-sm text-ink-3">{list.length} districts</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-surface-2">
                <span>
                  {p.name} <span className="text-xs text-ink-3">{p.kind}</span>
                </span>
                <button
                  className="text-xs text-danger opacity-60 hover:opacity-100"
                  aria-label={`Remove ${p.name}`}
                  onClick={async () => {
                    const { ok } = await confirm({ title: `Remove ${p.name}?`, confirm: 'Remove', danger: true });
                    if (!ok) return;
                    try {
                      await api.admin.del(q(`/admin/political-districts/${p.id}`));
                      setList(list.filter((x) => x.id !== p.id));
                    } catch (err: any) {
                      toast(err.message, 'error');
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="Change your password">
      <form
        className="grid max-w-md gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (f.next !== f.again) return setErr('The new passwords do not match.');
          try {
            await api.admin.post('/admin/password', { current: f.current, next: f.next });
            setF({ current: '', next: '', again: '' });
            toast('Password changed');
          } catch (e: any) {
            setErr(e.message);
          }
        }}
      >
        <TextField label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required minLength={10} />
        <TextField label="New password again" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" className="justify-self-start">Change password</Button>
      </form>
    </Card>
  );
}

interface AdminRow {
  id: number;
  email: string;
  name: string;
  region_id: number | null;
  region_name: string | null;
  last_login_at: string | null;
}

function AdminsCard() {
  const { me } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [f, setF] = useState({ name: '', email: '', password: '', regionId: '' });
  const national = me.region_id === null;

  useEffect(() => {
    if (national) api.admin.get<AdminRow[]>('/admin/admins').then(setRows, () => setRows([]));
  }, [national]);

  if (!national) return null;
  return (
    <Card title="Admins" subtitle="People who can open this dashboard. A regional admin only sees their own region.">
      {rows && (
        <ul className="mb-4 space-y-1 text-sm">
          {rows.map((a) => (
            <li key={a.id}>
              <b className="text-ink">{a.name}</b> <span className="text-ink-3">· {a.email} · {a.region_name ?? 'All regions'}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const row = await api.admin.post<AdminRow>('/admin/admins', { ...f, regionId: f.regionId ? Number(f.regionId) : null });
            setRows([...(rows ?? []), { ...row, region_name: me.regions.find((r) => r.id === row.region_id)?.name ?? null, last_login_at: null }]);
            setF({ name: '', email: '', password: '', regionId: '' });
            toast('Admin added. Share the password with them privately.');
          } catch (err: any) {
            toast(err.message, 'error');
          }
        }}
      >
        <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <TextField label="Temporary password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} hint="At least 10 characters. They can change it in Settings." />
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-ink" htmlFor="admin-region">Access</label>
          <Select id="admin-region" value={f.regionId} onChange={(e) => setF({ ...f, regionId: e.target.value })}>
            <option value="">All regions</option>
            {me.regions.map((r) => <option key={r.id} value={r.id}>{r.name} only</option>)}
          </Select>
        </div>
        <Button type="submit" className="justify-self-start">Add admin</Button>
      </form>
    </Card>
  );
}
