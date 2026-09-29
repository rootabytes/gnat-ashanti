import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChairShell } from '../../components/chair';
import { Alert } from '../../components/ui';
import { session } from '../../lib/api';
import { useSignedOutRedirect } from '../../lib/useSignedOut';
import { LocalFlow } from '../local/LocalFlow';

export default function DistrictLocalEditor() {
  useSignedOutRedirect();
  const { id } = useParams();
  const s = session.chair();
  if (!s || s.role !== 'district') return <Navigate to="/" replace />;
  return (
    <ChairShell subtitle={`${s.name} District`}>
      <LocalFlow
        key={id}
        base={`/district/locals/${id}`}
        detailsPath={`/district/locals/${id}`}
        header={
          <div className="mb-3 space-y-3">
            <Link to="/district?step=2" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to all locals
            </Link>
            <Alert tone="info">You are filling this local on behalf of its Local Secretary.</Alert>
          </div>
        }
      />
    </ChairShell>
  );
}
