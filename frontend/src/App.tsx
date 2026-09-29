import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui';
import Home from './pages/Home';
import Register from './pages/Register';
import DistrictWorkspace from './pages/district/DistrictWorkspace';
import DistrictLocalEditor from './pages/district/DistrictLocalEditor';
import LocalWorkspace from './pages/local/LocalWorkspace';

// Admin (and its charts) is a separate download so secretaries on mobile data never fetch it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
// Rarely opened pages stay out of the form bundle too.
const Privacy = lazy(() => import('./pages/Privacy'));
const Demo = lazy(() => import('./pages/Demo'));

const later = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/district" element={<DistrictWorkspace />} />
      <Route path="/district/locals/:id" element={<DistrictLocalEditor />} />
      <Route path="/local" element={<LocalWorkspace />} />
      <Route path="/privacy" element={later(<Privacy />)} />
      <Route path="/demo" element={later(<Demo />)} />
      <Route path="/admin/*" element={later(<AdminApp />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
