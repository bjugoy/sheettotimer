import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import App from './App';
import { LandingPage } from './pages/LandingPage';
import { PaywallPage } from './pages/PaywallPage';
import { DashboardPage } from './pages/DashboardPage';
import { useAuthStore } from './store/authStore';
import './index.css';

function RootRedirect() {
  const user    = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  if (loading) return null;
  return <Navigate to={user ? '/dashboard' : '/landing'} replace />;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize      = useAuthStore(s => s.initialize);
  const pendingPaywall  = useAuthStore(s => s.pendingPaywall);
  const clearPaywall    = useAuthStore(s => s.clearPaywall);
  const navigate        = useNavigate();

  useEffect(() => { initialize(); }, []);

  useEffect(() => {
    if (pendingPaywall) {
      clearPaywall();
      navigate('/paywall', { replace: true });
    }
  }, [pendingPaywall]);

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"          element={<RootRedirect />} />
          <Route path="/landing"   element={<LandingPage />} />
          <Route path="/app"       element={<App />} />
          <Route path="/paywall"   element={<PaywallPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
