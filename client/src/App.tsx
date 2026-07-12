import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Radio, Users, Copy, Check, LogIn, Save, UserCircle, ArrowLeft, LayoutDashboard, Share2, X } from 'lucide-react';
import { JoinRoom } from './components/JoinRoom';
import { LoadSchedulePage } from './components/LoadSchedulePage';
import { TimerView } from './components/TimerView';
import { ScheduleEditor } from './components/ScheduleEditor';
import { TeleprompterView } from './components/TeleprompterView';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { useScheduleStore } from './store/scheduleStore';
import { useSessionStore } from './store/sessionStore';
import { useAuthStore } from './store/authStore';
import { useSocket } from './hooks/useSocket';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { getPlanFeatures, PLAN_BADGE_COLOR } from './lib/plans';
import { getEvent, saveEventSchedule } from './lib/db';
import { cn } from './utils/timeUtils';

type AppView = 'join' | 'load' | 'timer' | 'teleprompter';

interface LocationState {
  from?: string;
  eventId?: string;
  eventName?: string;
  joinCode?: string;
  joinName?: string;
}

export default function App() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const locState  = (location.state ?? {}) as LocationState;

  const items               = useScheduleStore(s => s.items);
  const setActiveEventId    = useScheduleStore(s => s.setActiveEventId);
  const spreadsheetId       = useScheduleStore(s => s.spreadsheetId);
  const googleAuthenticated = useScheduleStore(s => s.googleAuthenticated);
  const setGoogleAuthenticated = useScheduleStore(s => s.setGoogleAuthenticated);
  const { checkAuthStatus, startOAuth, syncToSheet, syncing } = useGoogleSheets();

  const roomCode          = useSessionStore(s => s.roomCode);
  const users             = useSessionStore(s => s.users);
  const connected         = useSessionStore(s => s.connected);
  const isOperator        = useSessionStore(s => s.isOperator);
  const socketError       = useSessionStore(s => s.socketError);
  const sessionEndedReason = useSessionStore(s => s.sessionEndedReason);
  const leaveSession      = useSessionStore(s => s.leaveSession);

  const authUser      = useAuthStore(s => s.user);
  const plan          = useAuthStore(s => s.plan);
  const getToken      = useAuthStore(s => s.getToken);
  const features      = getPlanFeatures(plan);

  // If coming from dashboard or landing "try for free", skip the join screen
  const fromDashboard = locState.from === 'dashboard';
  const wantsJoin     = !!locState.joinCode;
  const hasStoredSession = (() => {
    try {
      const raw = sessionStorage.getItem('stt-session');
      if (!raw) return false;
      const { createdAt } = JSON.parse(raw) as { createdAt: number };
      return Date.now() - createdAt <= 24 * 60 * 60 * 1000;
    } catch { return false; }
  })();
  // Mobile Google auth lands here via /app?auth=google — go straight to load view.
  const googleAuthCallback = new URLSearchParams(window.location.search).get('auth') === 'google';
  const initialView: AppView = wantsJoin ? 'join'
    : fromDashboard ? 'load'
    : googleAuthCallback ? 'load'
    : hasStoredSession ? 'timer'
    : items.length > 0 ? 'load'
    : 'join';

  const [view, setView]             = useState<AppView>(initialView);
  // True while we're resolving which event to load — prevents stale persisted
  // items from auto-navigating to the timer before the correct event is ready
  const [eventSwitching, setEventSwitching] = useState(fromDashboard && !!locState.eventId);
  const [showEditor, setShowEditor] = useState(false);
  const [showAuth, setShowAuth]     = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShare, setShowShare]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savedOk, setSavedOk]       = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  const { createRoom, joinRoom, setUserRole } = useSocket();

  const [reconnectBanner, setReconnectBanner] = useState<'hidden' | 'reconnecting' | 'reconnected'>('hidden');

  useEffect(() => {
    if (connected) {
      if (reconnectBanner === 'reconnecting') {
        setReconnectBanner('reconnected');
        const t = setTimeout(() => setReconnectBanner('hidden'), 2000);
        return () => clearTimeout(t);
      }
      setReconnectBanner('hidden');
      return;
    }
    const t = setTimeout(() => setReconnectBanner('reconnecting'), 3000);
    return () => clearTimeout(t);
  }, [connected]);

  const guardNav = useCallback((action: () => void) => {
    if (!features.canSaveEvents && items.length > 0 && view === 'timer') {
      pendingNavRef.current = action;
      setShowLeaveWarning(true);
    } else {
      action();
    }
  }, [features.canSaveEvents, items.length, view]);

  // Warn on tab close / browser refresh when free user has an active schedule
  useEffect(() => {
    if (features.canSaveEvents || items.length === 0 || view !== 'timer') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [features.canSaveEvents, items.length, view]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    if (authParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (authParam === 'google') {
      // Returned from successful mobile OAuth redirect — auth is guaranteed active.
      // Don't rely on checkAuthStatus() here; cross-site cookies may be blocked on
      // mobile Safari, causing it to return false even though the session is valid.
      const mst = params.get('mst');
      if (mst) localStorage.setItem('gst', mst);
      setGoogleAuthenticated(true);
    } else {
      checkAuthStatus().then(setGoogleAuthenticated);
    }
  }, []);

  useEffect(() => {
    if (items.length > 0 && view === 'load' && !eventSwitching) setView('timer');
  }, [items.length, eventSwitching]);

  useEffect(() => {
    if (!roomCode || view !== 'join') return;
    // Operators with no schedule go to load (upload screen).
    // Viewers always go to timer — they wait for the operator to push a schedule.
    if (items.length > 0) setView('timer');
    else if (isOperator) setView('load');
    else setView('timer');
  }, [roomCode]);

  useEffect(() => {
    if (showEditor && !features.canUseEditor) setShowEditor(false);
  }, [features.canUseEditor]);

  // Auto-rejoin stored session as soon as the user's auth session resolves.
  // Fires once when authUser changes from null → user object.
  // This keeps participants in the same room when the creator refreshes.
  useEffect(() => {
    if (!authUser || roomCode) return; // skip if not authenticated or already in a room
    try {
      const raw = sessionStorage.getItem('stt-session');
      if (!raw) return;
      const stored = JSON.parse(raw) as { code: string; name: string; createdAt: number };
      if (Date.now() - stored.createdAt > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem('stt-session');
        return;
      }
      const token = getToken();
      joinRoom(stored.code, stored.name, token ?? undefined);
    } catch {}
  }, [authUser]);


  const handleCreateSession = () => {
    const token = getToken();
    const name  = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Operator';
    if (token) createRoom(name, token);
  };

  // Load / save per-event timer state when navigating between events
  const setItems    = useScheduleStore(s => s.setItems);
  const saveTimer   = useScheduleStore(s => s.saveTimer);
  const loadTimer   = useScheduleStore(s => s.loadTimer);
  useEffect(() => {
    if (!fromDashboard || !locState.eventId) return;

    const store = useScheduleStore.getState();
    const prevId = store.activeEventId;

    // Returning to the same event that's already live in the store —
    // the persisted items/currentIndex are already correct, nothing to reload
    const isAlreadyLoaded =
      prevId === locState.eventId &&
      store.items.length > 0 &&
      store.items.some(i => i.status === 'active' || i.status === 'done');

    if (isAlreadyLoaded) {
      setActiveEventId(locState.eventId);
      setEventSwitching(false);
      return;
    }

    // Leaving a different event — snapshot it before switching
    if (prevId && prevId !== locState.eventId) {
      saveTimer(prevId);
    }

    setActiveEventId(locState.eventId);

    // Try to restore a previously saved timer for this event
    if (loadTimer(locState.eventId)) {
      setEventSwitching(false);
      return;
    }

    // No saved state — load from Supabase or show upload page
    setItems([]);
    getEvent(locState.eventId).then(event => {
      if (event?.schedule && event.schedule.length > 0) {
        setItems(event.schedule);
      }
      setEventSwitching(false);
    });
  }, [locState.eventId]);

  const handleSaveToEvent = async () => {
    if (!locState.eventId || items.length === 0) return;
    setSaving(true);
    try {
      await saveEventSchedule(locState.eventId, items);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } finally { setSaving(false); }
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(`${window.location.origin}?room=${roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const joinUrl = roomCode ? `${window.location.origin}?room=${roomCode}` : '';

  const copyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSyncToSheets = useCallback(async () => {
    if (spreadsheetId) await syncToSheet(spreadsheetId, items);
  }, [spreadsheetId, items, syncToSheet]);

  const goBack = () => {
    if (fromDashboard) navigate('/dashboard');
    else setView('join');
  };

  if (view === 'teleprompter') return <TeleprompterView onClose={() => setView('timer')} />;

  if (view === 'join') return (
    <>
      <JoinRoom
        onSkip={() => setView('load')}
        onSignIn={() => setShowAuth(true)}
        prefilledCode={locState.joinCode}
        prefilledName={locState.joinName}
      />
      {showAuth   && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );

  if (view === 'load') return (
    <>
      <LoadSchedulePage
        isGoogleAuthed={googleAuthenticated}
        onGoogleAuth={startOAuth}
        canUseGoogleSheets={features.canUseGoogleSheets}
        onBack={goBack}
        backLabel={fromDashboard ? '← Dashboard' : '← Join Room'}
        onScheduleLoaded={locState.eventId
          ? (loaded) => saveEventSchedule(locState.eventId!, loaded).catch(console.error)
          : undefined}
      />
      {showAuth    && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );

  // Session expired overlay — shown to viewers when the room is cleaned up
  if (sessionEndedReason) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-warm-950 gap-4 p-8 text-center">
        <Radio className="w-8 h-8 text-warm-700" />
        <h2 className="text-lg font-semibold text-warm-300">Session ended</h2>
        <p className="text-sm text-warm-500 max-w-sm">{sessionEndedReason}</p>
        <button
          onClick={() => { leaveSession(); navigate(authUser ? '/dashboard' : '/landing', { replace: true }); }}
          className="mt-2 px-5 py-2.5 bg-crimson-800/60 hover:bg-crimson-700/60
            border border-crimson-700/50 rounded-lg text-sm text-warm-100 transition-colors">
          {authUser ? 'Go to dashboard' : 'Go home'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-warm-950">

      {/* ── Reconnect banner ──────────────────────────────────────────────── */}
      {reconnectBanner !== 'hidden' && (
        <div className={cn(
          'fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 py-1.5 text-xs font-medium transition-colors',
          reconnectBanner === 'reconnecting'
            ? 'bg-amber-900/90 text-amber-200 border-b border-amber-700/60'
            : 'bg-moss-900/90 text-moss-200 border-b border-moss-700/60'
        )}>
          {reconnectBanner === 'reconnecting' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Reconnecting to server…
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-moss-400" />
              Reconnected
            </>
          )}
        </div>
      )}

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-4 h-11
        border-b border-warm-800/50 bg-warm-900/60">

        <div className="flex items-center gap-3">
          {/* Left anchor — Dashboard back-button when opened from dashboard, logo otherwise */}
          {fromDashboard ? (
            <button onClick={() => guardNav(goBack)}
              className="flex items-center gap-1.5 text-warm-500 hover:text-warm-200 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Dashboard</span>
            </button>
          ) : (
            <button
              onClick={() => guardNav(() => {
                if (!authUser) setItems([]);
                navigate(authUser ? '/dashboard' : '/landing');
              })}
              className="flex items-center gap-1.5 text-warm-500 hover:text-warm-300 transition-colors"
              title={authUser ? 'Go to dashboard' : 'Go home'}
            >
              <img src="/STT_logo.png" className="w-4 h-4 rounded-sm object-contain" alt="" />
              <span className="hidden sm:inline text-xs font-semibold tracking-wide">SheetToTimer</span>
            </button>
          )}

          {/* Event name — only when opened from dashboard */}
          {fromDashboard && locState.eventName && (
            <div className="flex items-center gap-1.5">
              <span className="text-warm-800">·</span>
              <span className="text-[11px] text-warm-500 max-w-[160px] truncate">
                {locState.eventName}
              </span>
              {/* Save — only visible while editor is open */}
              {showEditor && items.length > 0 && (
                <button onClick={handleSaveToEvent} disabled={saving}
                  title="Save schedule edits to this event"
                  className={cn(
                    'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                    savedOk
                      ? 'text-moss-300 bg-moss-900/30 border border-moss-700/40'
                      : 'text-warm-600 hover:text-warm-400 hover:bg-warm-800/60 border border-transparent'
                  )}>
                  {savedOk ? <><Check className="w-3 h-3" /> Saved</> : <><Save className="w-3 h-3" /> Save</>}
                </button>
              )}
            </div>
          )}

          {/* Connected viewers — click to open Share/People panel */}
          {users.length > 0 && (
            <button onClick={() => setShowShare(s => !s)}
              className="flex items-center gap-1 text-warm-500 hover:text-warm-300
                px-1.5 py-1 rounded hover:bg-warm-800/50 transition-colors"
              title="Connected people">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">{users.length}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-moss-400' : 'bg-crimson-500')} />

          {/* Share — always visible in timer view */}
          <div className="relative ml-1">
            <button
              onClick={() => setShowShare(s => !s)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium',
                showShare
                  ? 'bg-warm-700 text-warm-100 border-warm-600'
                  : 'text-warm-300 border-warm-700/60 hover:bg-warm-800 hover:text-warm-100'
              )}>
              <Share2 className="w-3 h-3" />
              Share
            </button>

            {showShare && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowShare(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72
                  bg-warm-900 border border-warm-700/60 rounded-xl shadow-2xl p-4 space-y-4">

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-warm-300">Invite viewers</p>
                    <button onClick={() => setShowShare(false)} className="text-warm-600 hover:text-warm-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {roomCode ? (
                    <>
                      <p className="text-xs text-warm-400">
                        Your crew can follow this timer live on their own screens.
                        {users.length > 1 && (
                          <span className="ml-1 text-moss-400">{users.length} connected.</span>
                        )}
                      </p>

                      {/* Code */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-warm-600 uppercase tracking-wider">Code</p>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 font-mono font-bold text-xl text-warm-100 tracking-[0.25em]
                            bg-warm-800/60 border border-warm-700/40 rounded-lg px-3 py-2 text-center">
                            {roomCode}
                          </span>
                          <button onClick={copyCode}
                            className="flex items-center gap-1.5 px-3 py-2 bg-warm-800/60
                              hover:bg-warm-700/60 border border-warm-700/40 rounded-lg
                              text-xs text-warm-300 transition-colors shrink-0">
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-moss-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedCode ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Link */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-warm-600 uppercase tracking-wider">Link</p>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-[11px] text-warm-500 bg-warm-800/40
                            border border-warm-700/30 rounded-lg px-2.5 py-2 truncate font-mono">
                            {joinUrl}
                          </span>
                          <button onClick={copyLink}
                            className="flex items-center gap-1.5 px-3 py-2 bg-warm-800/60
                              hover:bg-warm-700/60 border border-warm-700/40 rounded-lg
                              text-xs text-warm-300 transition-colors shrink-0">
                            {copiedUrl ? <Check className="w-3.5 h-3.5 text-moss-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedUrl ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Connected users — operator can promote/demote */}
                      {users.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-warm-600 uppercase tracking-wider">
                            Connected ({users.length})
                          </p>
                          <div className="space-y-1">
                            {users.map(u => {
                              const isSelf = u.id === useSessionStore.getState().user?.id;
                              return (
                                <div key={u.id}
                                  className="flex items-center gap-2 px-2.5 py-1.5
                                    bg-warm-800/30 rounded-lg">
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                    u.role === 'operator' ? 'bg-crimson-400' : 'bg-warm-600'
                                  )} />
                                  <span className="flex-1 text-xs text-warm-300 truncate">
                                    {u.name}{isSelf && <span className="text-warm-600 ml-1">(you)</span>}
                                  </span>
                                  <span className={cn(
                                    'text-[9px] uppercase tracking-wide',
                                    u.role === 'operator' ? 'text-crimson-400' : 'text-warm-600'
                                  )}>
                                    {u.role}
                                  </span>
                                  {isOperator && !isSelf && (
                                    u.role === 'viewer' && !u.userId ? (
                                      <span className="text-[9px] text-warm-700 shrink-0" title="Guest — must sign in to become operator">
                                        Guest
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setUserRole(u.id, u.role === 'operator' ? 'viewer' : 'operator')}
                                        className="text-[9px] text-warm-600 hover:text-warm-300
                                          border border-warm-700/40 hover:border-warm-600/60
                                          px-1.5 py-0.5 rounded transition-colors shrink-0">
                                        {u.role === 'operator' ? '→ Viewer' : '→ Operator'}
                                      </button>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-warm-700">
                        Send the link or code to anyone who needs to follow the timer.
                        They join as viewers — you stay in control.
                      </p>

                      {/* Leave button for viewers — reachable on mobile */}
                      {!isOperator && (
                        <button
                          onClick={() => { leaveSession(); setView('load'); setShowShare(false); }}
                          className="w-full py-2 border border-warm-800/50 rounded-lg text-xs
                            text-warm-500 hover:text-warm-200 hover:border-warm-700 transition-colors">
                          Leave session
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-warm-400 leading-relaxed">
                        Want your crew to follow this timer on their own screens?
                        Generate an invite link — they open it and see the same countdown, live.
                      </p>

                      {socketError && (
                        <p className="text-[11px] text-crimson-300 bg-crimson-950/40
                          border border-crimson-800/40 rounded-lg px-3 py-2">
                          {socketError}
                        </p>
                      )}

                      {!connected && (
                        <p className="text-[11px] text-amber-400/80 bg-amber-950/30
                          border border-amber-800/30 rounded-lg px-3 py-2">
                          Not connected to server — check your connection.
                        </p>
                      )}

                      {features.canCreateRoom ? (
                        <button
                          onClick={handleCreateSession}
                          disabled={!connected}
                          className="w-full flex items-center justify-center gap-2 py-2.5
                            bg-crimson-800/60 hover:bg-crimson-700/60 border border-crimson-700/50
                            rounded-lg text-sm font-medium text-warm-100 transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed">
                          <Share2 className="w-3.5 h-3.5" />
                          Get invite link
                        </button>
                      ) : (
                        <p className="text-[11px] text-amber-400/80 bg-amber-950/30
                          border border-amber-800/30 rounded-lg px-3 py-2">
                          Invite links require a Pro plan or higher.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {features.canUseEditor && (
            <button onClick={() => setShowEditor(s => !s)}
              className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium',
                showEditor
                  ? 'bg-warm-700 text-warm-100 border-warm-600'
                  : 'text-warm-300 border-warm-700/60 hover:bg-warm-800 hover:text-warm-100')}>
              {showEditor ? '← Timer' : 'Editor'}
            </button>
          )}

          {features.canUsePresenter && !showEditor && (
            <button onClick={() => setView('teleprompter')}
              className="hidden sm:block text-xs px-3 py-1.5 rounded-lg border border-warm-700/60
                text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors font-medium">
              Presenter
            </button>
          )}

          {roomCode && !isOperator && (
            <button onClick={() => { leaveSession(); setView('load'); }}
              className="hidden sm:block text-xs px-3 py-1.5 rounded-lg border border-warm-700/60
                text-warm-400 hover:bg-warm-800 hover:text-warm-200 transition-colors">
              Leave
            </button>
          )}

          <button onClick={() => setView('load')}
            className="text-xs px-3 py-1.5 rounded-lg border border-warm-700/60
              text-warm-400 hover:bg-warm-800 hover:text-warm-200 transition-colors">
            Load
          </button>

          {authUser ? (
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <button onClick={() => setShowProfile(true)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors',
                  PLAN_BADGE_COLOR[plan],
                  'hover:brightness-125'
                )}>
                {getPlanFeatures(plan).label}
              </button>
              <button onClick={() => setShowProfile(true)} title="Account"
                className="flex items-center gap-1.5 text-xs text-warm-400
                  hover:text-warm-200 transition-colors max-w-[100px]">
                <UserCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {authUser.user_metadata?.full_name || authUser.email?.split('@')[0]}
                </span>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="hidden sm:flex items-center gap-1.5 ml-1 text-xs px-3 py-1.5 rounded-lg border
                border-warm-700/60 text-warm-300 hover:bg-warm-800 hover:text-warm-100 transition-colors">
              <LogIn className="w-3.5 h-3.5" /> Sign in
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {showEditor ? (
          <ScheduleEditor
            onClose={() => setShowEditor(false)}
            onSyncToSheets={spreadsheetId && features.canUseGoogleSheets ? handleSyncToSheets : undefined}
            hasSheetsConnection={!!spreadsheetId && googleAuthenticated && features.canUseGoogleSheets}
            isSyncing={syncing}
          />
        ) : (
          <TimerView
            onOpenTeleprompter={features.canUsePresenter ? () => setView('teleprompter') : undefined}
            onOpenEditor={features.canUseEditor ? () => setShowEditor(true) : undefined}
          />
        )}
      </main>

      {showAuth    && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {showLeaveWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-warm-900 border border-warm-700/60 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold text-warm-100">Schedule will not be saved</h3>
            <p className="text-xs text-warm-400 leading-relaxed">
              Your schedule will be cleared when you leave. On the Free plan, schedules are not saved to the cloud.
              Upgrade to Pro to save productions and events.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLeaveWarning(false); pendingNavRef.current = null; }}
                className="flex-1 py-2 border border-warm-700/50 rounded-lg text-xs
                  text-warm-400 hover:text-warm-200 hover:border-warm-600 transition-colors">
                Stay
              </button>
              <button
                onClick={() => {
                  setShowLeaveWarning(false);
                  setItems([]);
                  pendingNavRef.current?.();
                  pendingNavRef.current = null;
                }}
                className="flex-1 py-2 bg-crimson-800/60 hover:bg-crimson-700/60
                  border border-crimson-700/50 rounded-lg text-xs font-medium
                  text-warm-100 transition-colors">
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
