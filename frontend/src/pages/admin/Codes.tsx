import { useEffect, useMemo, useState } from 'react';
import { Printer, Scissors } from 'lucide-react';
import { Alert, Button, cx, Input, Loading, Select, SmsButton, StatusBadge, WhatsAppButton } from '../../components/ui';
import { api } from '../../lib/api';
import type { Status } from '../../lib/api';
import { districtInviteMessage, fmtPhone, localInviteMessage, smsLink, whatsappLink } from '../../lib/format';
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
  const [kind, setKind] = useState<'all' | CodeRow['kind']>('all');
  const [printing, setPrinting] = useState<'list' | 'slips'>('list');

  useEffect(() => {
    api.admin.get<CodeRow[]>(q('/admin/codes')).then(setRows, (e) => setError(e.message));
  }, [q]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) => (kind === 'all' || r.kind === kind) && (!s || `${r.name} ${r.district ?? ''} ${r.chair_name ?? ''}`.toLowerCase().includes(s)),
    );
  }, [rows, search, kind]);

  // Slips replace the table on paper only while printing; the page itself does not change.
  useEffect(() => {
    if (printing !== 'slips') return;
    const done = () => setPrinting('list');
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printing]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rows) return <Loading />;

  return (
    <div>
      <PageTitle
        title="Access codes"
        sub="Every district and local code in one place. Send a code from your own WhatsApp or SMS, read it out on a call, or print slips to hand out at a meeting."
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden />
              Print list
            </Button>
            <Button variant="secondary" onClick={() => setPrinting('slips')} disabled={!shown.some((r) => r.code)}>
              <Scissors className="h-4 w-4" aria-hidden />
              Print code slips
            </Button>
          </div>
        }
      />
      <div className="no-print mb-3">
        <Alert tone="warn">Codes let anyone edit that district's or local's form. Share each code only with its chairman.</Alert>
      </div>
      <div className="no-print mb-3 flex flex-wrap gap-2">
        <Input
          className="min-w-0 flex-1"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search codes"
        />
        <Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Show">
          <option value="all">Districts and locals</option>
          <option value="district">Districts only</option>
          <option value="local">Locals only</option>
        </Select>
      </div>
      <h2 className={cx('mb-2 hidden text-lg font-bold', printing === 'list' && 'print:block')}>GNAT {region.name}: Access codes</h2>
      <div className={cx('overflow-x-auto rounded-xl border border-line bg-surface print-plain', printing === 'slips' && 'print:hidden')}>
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
              const msg = r.code
                ? r.kind === 'district'
                  ? districtInviteMessage(r.name, r.code)
                  : localInviteMessage(r.name, r.district ?? '', r.code)
                : '';
              return (
                <tr key={`${r.kind}${r.id}`} className={`border-b border-line/60 ${r.kind === 'district' ? 'bg-surface-2/60' : ''}`}>
                  <td className="px-3 py-2">
                    {r.kind === 'district' ? (
                      <b className="text-ink">{r.name} District</b>
                    ) : (
                      <span className="pl-4 text-ink">
                        {r.name} <span className="text-ink-3">Local</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    {r.chair_name ?? '-'} {r.chair_phone && <span className="text-ink-3">· {fmtPhone(r.chair_phone)}</span>}
                  </td>
                  <td className="code-font px-3 py-2 font-bold text-brand">{r.code}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="no-print px-3 py-2 text-right">
                    {r.code && (
                      <span className="inline-flex gap-1.5">
                        <WhatsAppButton href={whatsappLink(msg, r.chair_phone)} label="Send" />
                        <SmsButton href={smsLink(msg, r.chair_phone)} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <p className="px-4 py-8 text-center text-sm text-ink-3">No codes yet.</p>}
      </div>
      {printing === 'slips' && <Slips rows={shown} region={region.name} />}
    </div>
  );
}

/** Cut-out slips, two per row, for handing codes to chairmen in person. */
function Slips({ rows, region }: { rows: CodeRow[]; region: string }) {
  const host = window.location.host;
  return (
    <div className="hidden grid-cols-2 print:grid">
      {rows
        .filter((r) => r.code)
        .map((r) => (
          <div key={`${r.kind}${r.id}`} className="break-inside-avoid border border-dashed border-black p-4 text-black">
            <p className="text-xs">GNAT Mapping · {region} Region</p>
            <p className="mt-1 text-base font-bold">{r.kind === 'district' ? `${r.name} District` : `${r.name} Local`}</p>
            {r.kind === 'local' && <p className="text-xs">{r.district} District</p>}
            {r.chair_name && <p className="text-xs">Chairman: {r.chair_name}</p>}
            <ol className="mt-2 list-decimal pl-5 text-sm">
              <li>
                On your phone, open <b>{host}</b>
              </li>
              <li>Enter this access code:</li>
            </ol>
            <p className="code-font mt-1 text-2xl font-extrabold tracking-wider">{r.code}</p>
            <p className="mt-2 text-[11px]">Keep this code private: it opens your form.</p>
          </div>
        ))}
    </div>
  );
}
