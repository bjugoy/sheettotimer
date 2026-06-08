import './instrument';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { useAuthStore } from './store/authStore';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import './index.css';

function UpdateBanner() {
  const updateAvailable = useUpdateCheck();
  if (!updateAvailable) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between
      px-4 py-2 bg-crimson-800 border-b border-crimson-700 shadow-lg">
      <span className="text-xs text-warm-100 font-medium">
        A new version of SheetToTimer is available.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="ml-4 shrink-0 text-xs px-3 py-1 bg-warm-100 text-crimson-900
          font-semibold rounded hover:bg-warm-200 transition-colors">
        Update now
      </button>
    </div>
  );
}

function RootRedirect() {
  const user    = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  if (loading) return null;
  return <Navigate to={user ? '/dashboard' : '/landing'} replace />;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore(s => s.initialize);
  useEffect(() => { initialize(); }, []);
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <UpdateBanner />
        <Routes>
          <Route path="/"          element={<RootRedirect />} />
          <Route path="/landing"   element={<LandingPage />} />
          <Route path="/app"       element={<App />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/privacy"    element={<PrivacyPolicyPage />} />
          <Route path="/terms"      element={<TermsOfServicePage />} />
          <Route path="*"          element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
