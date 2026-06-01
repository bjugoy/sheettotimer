import React, { useState, useEffect } from 'react';
import { Radio, UserCircle, Lock } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { useSessionStore } from '../store/sessionStore';
import { getPlanFeatures } from '../lib/plans';
import { cn } from '../utils/timeUtils';

interface Props {
  onSkip:          () => void;
  onSignIn:        () => void;
  prefilledCode?:  string;
  prefilledName?:  string;
}

type Mode = 'create' | 'join';

export function JoinRoom({ onSkip, onSignIn, prefilledCode, prefilledName }: Props) {
  const { createRoom, joinRoom } = useSocket();
  const user         = useAuthStore(s => s.user);
  const plan         = useAuthStore(s => s.plan);
  const getToken     = useAuthStore(s => s.getToken);
  const socketError  = useSessionStore(s => s.socketError);
  const setSocketError = useSessionStore(s => s.setSocketError);

  const features  = getPlanFeatures(plan);
  const canCreate = !!user && features.canCreateRoom;

  const [mode, setMode]   = useState<Mode>('join');
  const [name, setName]   = useState(prefilledName ?? '');
  const [code, setCode]   = useState(prefilledCode ?? '');
  const [error, setError] = useState('');

  const clearErrors = () => { setError(''); setSocketError(null); };

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) { setCode(roomParam.toUpperCase()); setMode('join'); }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your name'); return; }

    if (mode === 'create') {
      if (!canCreate) return;
      const token = getToken();
      if (!token) { setError('Sign in required to create a room'); return; }
      createRoom(name.trim(), token);
    } else {
      if (code.trim().length !== 6) { setError('Room code must be 6 characters'); return; }
      joinRoom(code.trim().toUpperCase(), name.trim(), getToken() ?? undefined);
    }
    setError('');
  };

  const inputCls = `w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-2
    text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60
    transition-colors`;

  return (
    <div className="min-h-screen bg-warm-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-7">
          <Radio className="w-7 h-7 text-crimson-400 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-warm-100">Program Timer</h1>
          <p className="text-xs text-warm-600 mt-1">Real-time show management</p>
        </div>

        <div className="bg-warm-900/70 border border-warm-800/60 rounded-xl p-5 space-y-4">

          {/* Tab toggle */}
          <div className="flex gap-1 bg-warm-800/60 rounded-lg p-1">
            {(['create', 'join'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); clearErrors(); }}
                className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  mode === m ? 'bg-warm-700/80 text-warm-100' : 'text-warm-600 hover:text-warm-400')}>
                {m === 'create' ? 'Create room' : 'Join room'}
              </button>
            ))}
          </div>

          {/* Create room — plan gate */}
          {mode === 'create' && !canCreate && (
            <div className="bg-warm-800/40 border border-warm-700/40 rounded-lg px-4 py-3 space-y-2 text-center">
              <Lock className="w-4 h-4 text-warm-600 mx-auto" />
              {!user ? (
                <>
                  <p className="text-xs text-warm-500">Sign in with a premium plan to create a room.</p>
                  <button onClick={onSignIn}
                    className="text-xs text-crimson-300 hover:text-crimson-200 underline underline-offset-2 transition-colors">
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-warm-500">Your <span className="text-warm-300">Free</span> plan doesn't include rooms.</p>
                  <p className="text-[11px] text-warm-700">Upgrade to Pro, Studio, or Enterprise to create rooms.</p>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] text-warm-600 mb-1 block">Your name</label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-700" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex" autoFocus
                  className={`${inputCls} pl-9`} />
              </div>
            </div>

            {mode === 'join' && (
              <div>
                <label className="text-[11px] text-warm-600 mb-1 block">Room code</label>
                <input type="text" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX"
                  className={`${inputCls} font-mono tracking-[0.3em] text-center text-lg`} />
              </div>
            )}

            {(error || socketError) && (
              <p className="text-xs text-crimson-300">{error || socketError}</p>
            )}

            {(mode === 'join' || canCreate) && (
              <button type="submit"
                className="w-full py-2.5 bg-crimson-800/60 hover:bg-crimson-700/60
                  border border-crimson-700/50 rounded-lg text-sm font-medium
                  text-warm-100 transition-colors">
                {mode === 'create' ? 'Create room' : 'Join room'}
              </button>
            )}
          </form>

          <div className="pt-1 text-center border-t border-warm-800/40">
            <button onClick={onSkip}
              className="text-[11px] text-warm-700 hover:text-warm-500 transition-colors mt-2">
              Continue without a room (local only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
