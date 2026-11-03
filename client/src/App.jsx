import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import LoginChooser from './pages/LoginChooser';
import Login from './pages/Login';
import RegisterChooser from './pages/RegisterChooser';
import Register from './pages/Register';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import FindWorkers from './pages/FindWorkers';
import PublicProfile from './pages/PublicProfile';
import NotFound from './pages/NotFound';

import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerProfileEdit from './pages/worker/WorkerProfileEdit';
import Verification from './pages/worker/Verification';

import EmployerDashboard from './pages/employer/EmployerDashboard';
import JobForm from './pages/employer/JobForm';
import ManageJob from './pages/employer/ManageJob';
import EmployerProfileEdit from './pages/employer/EmployerProfileEdit';

import AdminDashboard from './pages/admin/AdminDashboard';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginChooser />} />
        <Route path="/login/:role" element={<Login />} />
        <Route path="/register" element={<RegisterChooser />} />
        <Route path="/register/:role" element={<Register />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/workers" element={<FindWorkers />} />
        <Route path="/profile/:id" element={<PublicProfile />} />

        {/* Worker only */}
        <Route element={<ProtectedRoute roles={['worker']} />}>
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker/profile" element={<WorkerProfileEdit />} />
          <Route path="/worker/verification" element={<Verification />} />
        </Route>

        {/* Employer only */}
        <Route element={<ProtectedRoute roles={['employer']} />}>
          <Route path="/employer/dashboard" element={<EmployerDashboard />} />
          <Route path="/employer/jobs/new" element={<JobForm />} />
          <Route path="/employer/jobs/:id/edit" element={<JobForm />} />
          <Route path="/employer/jobs/:id" element={<ManageJob />} />
          <Route path="/employer/profile" element={<EmployerProfileEdit />} />
        </Route>

        {/* Admin only */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
