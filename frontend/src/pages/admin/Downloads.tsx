import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Card, useToast } from '../../components/ui';
import { adminDownload } from '../../lib/api';
import { PageTitle, useAdmin } from './AdminApp';

export default function Downloads() {
  const { q } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const get = async (key: string, path: string, name: string) => {
    setBusy(key);
    try {
      await adminDownload(q(path), name);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const items: { key: string; title: string; desc: string; path: string; name: string; cta: string; icon: LucideIcon }[] = [
    {
      key: 'xlsx',
      title: 'Full workbook (Excel)',
      desc: 'Summary, districts, district mapping, locals, basic units and political district coverage, one sheet each. Best for analysis.',
      path: '/admin/export.xlsx',
      name: 'GNAT_Mapping.xlsx',
      cta: 'Download Excel',
      icon: FileSpreadsheet,
    },
    {
      key: 'pdf',
      title: 'Printable report (PDF)',
      desc: 'Branded summary with key figures, charts, district table, coverage gaps and the full structure as an appendix. Best for meetings.',
      path: '/admin/report.pdf',
      name: 'GNAT_Mapping_Report.pdf',
      cta: 'Download PDF',
      icon: FileText,
    },
    {
      key: 'units',
      title: 'Basic units (CSV)',
      desc: 'One row per workplace: region, district, local, workplace, category.',
      path: '/admin/export.csv?level=units',
      name: 'units.csv',
      cta: 'Download CSV',
      icon: Sheet,
    },
    {
      key: 'locals',
      title: 'Locals (CSV)',
      desc: 'One row per local with chairman, workplace count and status.',
      path: '/admin/export.csv?level=locals',
      name: 'locals.csv',
      cta: 'Download CSV',
      icon: Sheet,
    },
    {
      key: 'districts',
      title: 'Districts (CSV)',
      desc: 'One row per GNAT district with political districts covered, chairman and progress.',
      path: '/admin/export.csv?level=districts',
      name: 'districts.csv',
      cta: 'Download CSV',
      icon: Sheet,
    },
  ];

  return (
    <div>
      <PageTitle title="Downloads" sub="Always generated from the latest data." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card
            key={i.key}
            title={
              <span className="inline-flex items-center gap-2">
                <i.icon className="h-5 w-5 text-brand" aria-hidden />
                {i.title}
              </span>
            }
          >
            <p className="text-sm text-ink-2">{i.desc}</p>
            <Button className="mt-4" busy={busy === i.key} onClick={() => get(i.key, i.path, i.name)}>
              {busy !== i.key && <Download className="h-4 w-4" aria-hidden />}
              {i.cta}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
