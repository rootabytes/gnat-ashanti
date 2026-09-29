import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, CopyButton, Modal, SmsButton, TextField, useConfirm, useToast, WhatsAppButton } from '../../components/ui';
import { api } from '../../lib/api';
import { districtInviteMessage, fmtPhone, plural, smsLink, whatsappLink } from '../../lib/format';
import type { DistrictDetail } from '../../lib/types';
import { useAdmin } from './AdminApp';

const EMPTY = { name: '', chairName: '', chairPhone: '' };

/**
 * Adding a District Secretary: their GNAT district, name and phone, then straight on to sending
 * the district's access code from the Regional Secretary's own WhatsApp or SMS. Opened from the
 * menu, the Overview and the Districts page (AdminShell owns it).
 */
export function AddDistrictModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { q } = useAdmin();
  const nav = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [added, setAdded] = useState<DistrictDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(EMPTY);
    setAdded(null);
    setErr(null);
  }, [open]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const d = await api.admin.post<DistrictDetail>(q('/admin/districts'), {
        name: f.name,
        chairName: f.chairName || null,
        chairPhone: f.chairPhone || null,
      });
      setAdded(d);
      onAdded();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (added) {
    const msg = added.code ? districtInviteMessage(added.name, added.code) : '';
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`Send ${added.name} its code`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                nav(`/admin/districts/${added.id}`);
              }}
            >
              Open district
            </Button>
            <Button
              onClick={() => {
                setF(EMPTY);
                setAdded(null);
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add another
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="success">{added.chairName ? `${added.chairName} added for ${added.name}.` : `${added.name} added.`}</Alert>
          <p className="text-sm text-ink-2">
            Send this code to the District Secretary from your own WhatsApp or SMS. The link opens their district form directly.
          </p>
          <div className="rounded-xl border-2 border-dashed border-brand bg-brand-soft p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Access code</p>
            <p className="code-font mt-1 text-2xl font-extrabold text-brand">{added.code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton
              size="md"
              href={whatsappLink(msg, added.chairPhone)}
              label={added.chairPhone ? `WhatsApp ${fmtPhone(added.chairPhone)}` : 'Share on WhatsApp'}
            />
            <SmsButton size="md" href={smsLink(msg, added.chairPhone)} />
            <CopyButton size="md" text={msg} label="Copy message" />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a District Secretary">
      <form onSubmit={add} className="space-y-3">
        <p className="text-sm text-ink-2">
          Enter the GNAT district and its secretary. You then get the district's access code to send them on WhatsApp or SMS.
        </p>
        <TextField
          label="GNAT district name"
          placeholder="e.g. Kumasi Metro"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
          minLength={2}
        />
        <TextField
          label="District Secretary's full name"
          autoComplete="off"
          value={f.chairName}
          onChange={(e) => setF({ ...f, chairName: e.target.value })}
        />
        <TextField
          label="District Secretary's phone"
          hint="Their WhatsApp number, so the code goes straight to them."
          type="tel"
          inputMode="tel"
          placeholder="024 123 4567"
          value={f.chairPhone}
          onChange={(e) => setF({ ...f, chairPhone: e.target.value })}
        />
        {err && <Alert tone="error">{err}</Alert>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={f.name.trim().length < 2}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add District Secretary
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Removing a District Secretary. Their code stops working at once and their name and phone are
 * cleared; the district's locals and workplaces stay for a new secretary. A district with no locals
 * yet was most likely added by mistake, so the server deletes it. Resolves to what happened, or
 * null if cancelled or failed.
 */
export function useRemoveDistrictSecretary() {
  const confirm = useConfirm();
  const toast = useToast();
  return async (d: { id: number; name: string; chairName: string | null; locals: number }) => {
    const who = d.chairName ?? 'the District Secretary';
    const { ok } = await confirm({
      title: `Remove ${who}?`,
      body: d.locals
        ? `${who} loses access at once: the ${d.name} code stops working and they are signed out. The district's ${plural(d.locals, 'local')} and workplaces are kept, so you can add a new secretary.`
        : `${who} loses access at once. Nothing has been filled in for ${d.name} yet, so the district is removed from the list too. You can add it again with Add District Secretary.`,
      confirm: 'Remove',
      danger: true,
    });
    if (!ok) return null;
    try {
      const r = await api.admin.post<{ removed: 'district' | 'secretary'; district: DistrictDetail | null }>(
        `/admin/districts/${d.id}/remove-secretary`,
      );
      toast(r.removed === 'district' ? `${d.name} removed` : `${who} removed from ${d.name}`);
      return r;
    } catch (e: any) {
      toast(e.message, 'error');
      return null;
    }
  };
}
