import { useEffect, useState } from 'react';
import { Alert, Card, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { PageTitle, useAdmin } from './AdminApp';
import { ActivityList } from './Overview';
import type { AuditRow } from './Overview';

export default function Activity() {
  const { q } = useAdmin();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.admin.get<AuditRow[]>(q('/admin/audit?limit=300')).then(setRows, (e) => setError(e.message));
  }, [q]);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rows) return <Loading />;
  return (
    <div>
      <PageTitle title="Activity" sub="Who changed what, most recent first. The last 300 events." />
      <Card>
        <ActivityList rows={rows} />
      </Card>
    </div>
  );
}
