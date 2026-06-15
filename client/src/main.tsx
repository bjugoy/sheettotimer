import './instrument';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PaywallPage } from './pages/PaywallPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { useAuthStore } from './store/authStore';
import { useScheduleStore } from './store/scheduleStore';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { syncPlanFromStripe } from './lib/billing';
import { CookieBanner } from './components/CookieBanner';
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

  // Room invite links: /?room=CODE — send everyone straight to /app regardless of auth state
  const roomCode = new URLSearchParams(window.location.search).get('room');
  if (roomCode) {
    return <Navigate to="/app" state={{ joinCode: roomCode, joinName: '' }} replace />;
  }

  if (loading) return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-warm-700 border-t-crimson-500 animate-spin" />
    </div>
  );
  if (user) {
    const isNew = sessionStorage.getItem('stt-new-signup');
    if (isNew) {
      sessionStorage.removeItem('stt-new-signup');
      return <Navigate to="/paywall" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/landing" replace />;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize    = useAuthStore(s => s.initialize);
  const getToken      = useAuthStore(s => s.getToken);
  const setPlan       = useAuthStore(s => s.setPlan);
  const refreshPlan   = useAuthStore(s => s.refreshPlan);

  useEffect(() => {
    useScheduleStore.getState().expireIfStale();
    initialize();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') !== 'success') return;
    window.history.replaceState({}, '', window.location.pathname);
    const token = getToken();
    if (token) {
      syncPlanFromStripe(token).then(plan => {
        if (plan) setPlan(plan as import('./lib/plans').Plan);
        else refreshPlan();
      });
    } else {
      refreshPlan();
    }
  }, []);

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <UpdateBanner />
        <CookieBanner />
        <Routes>
          <Route path="/"          element={<RootRedirect />} />
          <Route path="/landing"   element={<LandingPage />} />
          <Route path="/app"       element={<App />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/paywall"    element={<PaywallPage />} />
          <Route path="/privacy"    element={<PrivacyPolicyPage />} />
          <Route path="/terms"      element={<TermsOfServicePage />} />
          <Route path="*"          element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    <Analytics />
    </ErrorBoundary>
  </React.StrictMode>
);
