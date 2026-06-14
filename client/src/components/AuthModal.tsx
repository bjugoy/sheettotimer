import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User, Radio } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/timeUtils';

interface Props {
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

type Mode = 'signin' | 'signup' | 'reset' | 'confirm';

export function AuthModal({ onClose, defaultMode = 'signin' }: Props) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode]         = useState<Mode>(defaultMode);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');

    if (mode === 'reset') {
      if (!email.trim()) { setError('Email is required'); return; }
      setLoading(true);
      const err = await resetPassword(email.trim());
      setLoading(false);
      if (err) setError(err);
      else setInfo('Check your email for a password reset link.');
      return;
    }

    if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Name is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    const err = mode === 'signin'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, name.trim());
    setLoading(false);

    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      sessionStorage.setItem('stt-new-signup', '1');
      setMode('confirm');
    } else {
      onClose();
      navigate('/dashboard', { replace: true });
    }
  };

  const inputCls = 'w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2 pl-9 text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60 transition-colors';

  // ── Email confirmation screen ─────────────────────────────────────────────
  if (mode === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-800/60 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-warm-800/40">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-crimson-400" />
              <span className="text-sm font-semibold text-warm-200">SheetToTimer</span>
            </div>
            <button onClick={onClose} className="text-warm-700 hover:text-warm-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-900/30 border border-green-700/30
              flex items-center justify-center mx-auto">
              <Mail className="w-5 h-5 text-green-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-warm-200">Check your email</p>
              <p className="text-xs text-warm-400 leading-relaxed">
                We sent a confirmation link to{' '}
                <span className="text-warm-200">{email}</span>.
                Click it to activate your account.
              </p>
            </div>
            <button
              onClick={() => switchMode('signin')}
              className="w-full py-2 mt-2 border border-warm-700/50 rounded-lg text-xs
                text-warm-400 hover:text-warm-200 hover:border-warm-600/60 transition-colors">
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-800/60 rounded-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-warm-800/40">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-crimson-400" />
            <span className="text-sm font-semibold text-warm-200">SheetToTimer</span>
          </div>
          <button onClick={onClose} className="text-warm-700 hover:text-warm-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — only for signin/signup */}
        {mode !== 'reset' && (
          <div className="px-5 pt-4">
            <div className="flex gap-1 bg-warm-800/60 rounded-lg p-1">
              {(['signin', 'signup'] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
                    mode === m ? 'bg-warm-700/80 text-warm-100' : 'text-warm-600 hover:text-warm-400')}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'reset' && (
          <div className="px-5 pt-4">
            <p className="text-xs text-warm-400">Enter your email and we'll send you a reset link.</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pt-4 pb-5 space-y-3">
          {mode === 'signup' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-700" />
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Full name" autoFocus className={inputCls} />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-700" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" autoFocus={mode !== 'signup'} className={inputCls} />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-700" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" className={inputCls} />
            </div>
          )}

          {mode === 'signin' && (
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={() => switchMode('reset')}
                className="text-[11px] text-warm-600 hover:text-warm-400 transition-colors">
                Forgot password?
              </button>
            </div>
          )}

          {error && <p className="text-xs text-crimson-300 pt-0.5">{error}</p>}
          {info  && <p className="text-xs text-green-400 pt-0.5">{info}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 mt-1 bg-crimson-800/60 hover:bg-crimson-700/60
              border border-crimson-700/50 rounded-lg text-sm font-medium text-warm-100
              transition-colors disabled:opacity-50">
            {loading ? '…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          {mode === 'reset' && (
            <button type="button" onClick={() => switchMode('signin')}
              className="w-full text-xs text-warm-600 hover:text-warm-400 transition-colors pt-1">
              ← Back to sign in
            </button>
          )}

          {mode !== 'reset' && (
            <>
              <div className="relative flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-warm-800/60" />
                <span className="text-[10px] text-warm-700">or</span>
                <div className="flex-1 border-t border-warm-800/60" />
              </div>

              <button type="button" disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const err = await signInWithGoogle();
                  setLoading(false);
                  if (err) setError(err);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5
                  bg-warm-800/60 hover:bg-warm-700/60 border border-warm-700/50
                  rounded-lg text-sm font-medium text-warm-200 transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="pt-1 border-t border-warm-800/40">
                <p className="text-[10px] text-warm-700 leading-relaxed">
                  <span className="text-warm-500">Free</span> — upload &amp; run timer, local only ·{' '}
                  <span className="text-amber-400">Pro €4.99</span> — save events + sheets + rooms for 5 ·{' '}
                  <span className="text-crimson-400">Studio €6.99</span> — rooms for 15 + custom columns
                </p>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
