import { Navigate } from 'react-router-dom';
import { ChairShell } from '../../components/chair';
import { session } from '../../lib/api';
import { useSignedOutRedirect } from '../../lib/useSignedOut';
import { LocalFlow } from './LocalFlow';

export default function LocalWorkspace() {
  useSignedOutRedirect();
  const s = session.chair();
  if (!s || s.role !== 'local') return <Navigate to="/" replace />;
  return (
    <ChairShell subtitle={`${s.name} Local`} guide={{ role: 'local', key: s.name }}>
      <LocalFlow base="/local" detailsPath={null} />
    </ChairShell>
  );
}
