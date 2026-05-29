import React, { useState } from 'react';
import { X, Mail, Lock, User, Radio } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/timeUtils';

interface Props {
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

type Mode = 'signin' | 'signup';

export function AuthModal({ onClose, defaultMode = 'signin' }: Props) {
  const { signIn, signUp } = useAuthStore();

  const [mode, setMode]         = useState<Mode>(defaultMode);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
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
      localStorage.setItem('stt-paywall', '1');
      setInfo('Account created! Check your email to confirm — you\'ll be taken to plan selection automatically.');
      setMode('signin');
    } else {
      onClose();
    }
  };

  const inputCls = 'w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2 pl-9 text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-800/60 rounded-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-warm-800/40">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-crimson-400" />
            <span className="text-sm font-semibold text-warm-200">Program Timer</span>
          </div>
          <button onClick={onClose} className="text-warm-700 hover:text-warm-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-1 bg-warm-800/60 rounded-lg p-1">
            {(['signin', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }}
                className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === m ? 'bg-warm-700/80 text-warm-100' : 'text-warm-600 hover:text-warm-400')}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        </div>

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
              placeholder="Email" autoFocus={mode === 'signin'} className={inputCls} />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-700" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" className={inputCls} />
          </div>

          {error && <p className="text-xs text-crimson-300 pt-0.5">{error}</p>}
          {info  && <p className="text-xs text-moss-300 pt-0.5">{info}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 mt-1 bg-crimson-800/60 hover:bg-crimson-700/60
              border border-crimson-700/50 rounded-lg text-sm font-medium text-warm-100
              transition-colors disabled:opacity-50">
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {/* Plan summary */}
          <div className="pt-1 border-t border-warm-800/40 space-y-1">
            <p className="text-[10px] text-warm-700 leading-relaxed">
              <span className="text-warm-500">Free</span> — upload &amp; timer view<br />
              <span className="text-amber-400">Pro</span> — editor + room for 5 · <span className="text-crimson-400">Studio</span> — room for 15 · <span className="text-moss-400">Enterprise</span> — room for 50
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
