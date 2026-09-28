import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Loading, StatusBadge, WhatsAppButton } from '../../components/ui';
import { api } from '../../lib/api';
import type { Status } from '../../lib/api';
import { districtInviteMessage, fmtPhone, localInviteMessage, whatsappLink } from '../../lib/format';
import { PageTitle, useAdmin } from './AdminApp';

interface CodeRow {
  kind: 'district' | 'local';
  id: number;
  name: string;
  district: string | null;
  chair_name: string | null;
  chair_phone: string | null;
  status: Status;
  code: string | null;
}

export default function Codes() {
  const { q, region } = useAdmin();
  const [rows, setRows] = useState<CodeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.admin.get<CodeRow[]>(q('/admin/codes')).then(setRows, (e) => setError(e.message));
  }, [q]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || `${r.name} ${r.district ?? ''} ${r.chair_name ?? ''}`.toLowerCase().includes(s));
  }, [rows, search]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rows) return <Loading />;

  return (
    <div>
      <PageTitle
        title="Access codes"
        sub="Every district and local code in one place. Print it, or send codes on WhatsApp."
        action={<Button variant="secondary" className="no-print" onClick={() => window.print()}>Print list</Button>}
      />
      <div className="no-print mb-3">
        <Alert tone="warn">Codes let anyone edit that district's or local's form. Share each code only with its chairman.</Alert>
      </div>
      <Input className="no-print mb-3" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search codes" />
      <h2 className="mb-2 hidden text-lg font-bold print:block">GNAT {region.name}: Access codes</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface print-plain">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="px-3 py-2 font-semibold">District / Local</th>
              <th className="px-3 py-2 font-semibold">Chairman</th>
              <th className="px-3 py-2 font-semibold">Code</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="no-print px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const msg = r.code ? (r.kind === 'district' ? districtInviteMessage(r.name, r.code) : localInviteMessage(r.name, r.district ?? '', r.code)) : '';
              return (
                <tr key={`${r.kind}${r.id}`} className={`border-b border-line/60 ${r.kind === 'district' ? 'bg-surface-2/60' : ''}`}>
                  <td className="px-3 py-2">
                    {r.kind === 'district' ? <b className="text-ink">{r.name} District</b> : <span className="pl-4 text-ink">{r.name} <span className="text-ink-3">Local</span></span>}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{r.chair_name ?? '-'} {r.chair_phone && <span className="text-ink-3">· {fmtPhone(r.chair_phone)}</span>}</td>
                  <td className="code-font px-3 py-2 font-bold text-brand">{r.code}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="no-print px-3 py-2 text-right">{r.code && <WhatsAppButton href={whatsappLink(msg, r.chair_phone)} label="Send" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <p className="px-4 py-8 text-center text-sm text-ink-3">No codes yet.</p>}
      </div>
    </div>
  );
}
