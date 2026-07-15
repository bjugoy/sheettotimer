import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function ResetPasswordPage() {
  const navigate            = useNavigate();
  const needsPasswordReset  = useAuthStore(s => s.needsPasswordReset);
  const updatePassword      = useAuthStore(s => s.updatePassword);
  const loading             = useAuthStore(s => s.loading);

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  // If someone navigates here directly without a recovery session, send them away
  useEffect(() => {
    if (!loading && !needsPasswordReset) {
      navigate('/', { replace: true });
    }
  }, [loading, needsPasswordReset, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const err = await updatePassword(password);
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
  };

  if (loading || !needsPasswordReset) return null;

  return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <KeyRound className="w-8 h-8 text-crimson-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-warm-100">Set a new password</h1>
          <p className="text-xs text-warm-500 mt-1">Choose a strong password for your account.</p>
        </div>

        <div className="bg-warm-900/70 border border-warm-800/60 rounded-xl p-6">
          {done ? (
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-moss-400">Password updated!</p>
              <p className="text-xs text-warm-500">Redirecting to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-warm-400">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2.5
                    text-sm text-warm-200 placeholder-warm-700 focus:outline-none
                    focus:border-crimson-700/60 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-warm-400">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2.5
                    text-sm text-warm-200 placeholder-warm-700 focus:outline-none
                    focus:border-crimson-700/60 transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-crimson-300">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="w-full py-2.5 bg-crimson-800/70 hover:bg-crimson-700/70
                  disabled:opacity-40 disabled:cursor-not-allowed border border-crimson-700/50
                  rounded-lg text-sm font-semibold text-warm-100 transition-colors">
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
