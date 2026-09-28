import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui';
import Home from './pages/Home';
import Register from './pages/Register';
import DistrictWorkspace from './pages/district/DistrictWorkspace';
import DistrictLocalEditor from './pages/district/DistrictLocalEditor';
import LocalWorkspace from './pages/local/LocalWorkspace';

// Admin (and its charts) is a separate download so chairmen on mobile data never fetch it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/district" element={<DistrictWorkspace />} />
      <Route path="/district/locals/:id" element={<DistrictLocalEditor />} />
      <Route path="/local" element={<LocalWorkspace />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Loading />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
