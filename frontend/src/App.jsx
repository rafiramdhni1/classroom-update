import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/Toaster';
import { FullPageLoading } from './components/ui';

const Login = React.lazy(() => import('./pages/Login'));
const StudentPanel = React.lazy(() => import('./pages/student/StudentPanel'));
const StaffPanel = React.lazy(() => import('./pages/staff/StaffPanel'));

function Loading() {
  return <FullPageLoading label="Memuat aplikasi..." subtitle="Menyiapkan sistem akademik" />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin' && user.role !== 'guru') return <Navigate to="/dashboard" />;
  return children;
}

function StudentRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin' || user.role === 'guru') return <Navigate to="/admin" />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Toaster />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <StudentRoute>
                    <StudentPanel />
                  </StudentRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <StaffPanel />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
