import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Radio, Users, Copy, Check, LogIn, Save, UserCircle } from 'lucide-react';
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
}

export default function App() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const locState  = (location.state ?? {}) as LocationState;

  const items               = useScheduleStore(s => s.items);
  const spreadsheetId       = useScheduleStore(s => s.spreadsheetId);
  const googleAuthenticated = useScheduleStore(s => s.googleAuthenticated);
  const setGoogleAuthenticated = useScheduleStore(s => s.setGoogleAuthenticated);
  const { checkAuthStatus, startOAuth, syncToSheet, syncing } = useGoogleSheets();

  const roomCode  = useSessionStore(s => s.roomCode);
  const users     = useSessionStore(s => s.users);
  const connected = useSessionStore(s => s.connected);

  const authUser   = useAuthStore(s => s.user);
  const plan       = useAuthStore(s => s.plan);
  const features   = getPlanFeatures(plan);

  // If coming from dashboard or landing "try for free", skip the join screen
  const fromDashboard = locState.from === 'dashboard';
  const initialView: AppView = (fromDashboard || items.length > 0) ? 'load' : 'join';

  const [view, setView]             = useState<AppView>(initialView);
  const [showEditor, setShowEditor] = useState(false);
  const [showAuth, setShowAuth]     = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savedOk, setSavedOk]       = useState(false);

  useSocket();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'success') window.history.replaceState({}, '', location.pathname);
    checkAuthStatus().then(setGoogleAuthenticated);
  }, []);

  useEffect(() => {
    if (items.length > 0 && view === 'load') setView('timer');
  }, [items.length]);

  useEffect(() => {
    if (roomCode && view === 'join') setView(items.length > 0 ? 'timer' : 'load');
  }, [roomCode]);

  useEffect(() => {
    if (showEditor && !features.canUseEditor) setShowEditor(false);
  }, [features.canUseEditor]);

  // Load saved schedule when opening an event from the dashboard
  const setItems = useScheduleStore(s => s.setItems);
  useEffect(() => {
    if (!fromDashboard || !locState.eventId) return;
    getEvent(locState.eventId).then(event => {
      if (event?.schedule && event.schedule.length > 0) {
        setItems(event.schedule);
        // setItems triggers the items.length effect → moves to 'timer'
      }
      // If no saved schedule, stay on 'load' so user can upload
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

  const handleSyncToSheets = useCallback(async () => {
    if (spreadsheetId) await syncToSheet(spreadsheetId, items);
  }, [spreadsheetId, items, syncToSheet]);

  const goBack = () => {
    if (fromDashboard) navigate('/dashboard');
    else navigate('/landing');
  };

  if (view === 'teleprompter') return <TeleprompterView onClose={() => setView('timer')} />;

  if (view === 'join') return (
    <>
      <JoinRoom onSkip={() => setView('load')} onSignIn={() => setShowAuth(true)} />
      {showAuth   && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );

  if (view === 'load') return (
    <>
      <LoadSchedulePage
        isGoogleAuthed={googleAuthenticated}
        onGoogleAuth={startOAuth}
        onBack={goBack}
        backLabel={fromDashboard ? '← Dashboard' : '← Home'}
        onScheduleLoaded={locState.eventId
          ? (loaded) => saveEventSchedule(locState.eventId!, loaded).catch(console.error)
          : undefined}
      />
      {showAuth    && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-warm-950">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-4 h-9
        border-b border-warm-800/50 bg-warm-900/60">

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-warm-500">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold text-warm-400 tracking-wide">SheetToTimer</span>
          </div>

          {roomCode && (
            <div className="flex items-center gap-1.5">
              <span className="text-warm-800">·</span>
              <span className="text-xs timer-display font-bold text-warm-400 tracking-widest">{roomCode}</span>
              <button onClick={copyRoomCode}
                className="text-warm-700 hover:text-warm-500 transition-colors" title="Copy join link">
                {copied ? <Check className="w-3 h-3 text-moss-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}

          {users.length > 0 && (
            <div className="flex items-center gap-1 text-warm-700">
              <Users className="w-3 h-3" />
              <span className="text-[10px]">{users.length}</span>
            </div>
          )}

          {/* Event name + save button — shown when timer was opened from dashboard */}
          {fromDashboard && locState.eventName && (
            <div className="flex items-center gap-2">
              <span className="text-warm-800">·</span>
              <span className="text-[11px] text-warm-600 max-w-[140px] truncate">
                {locState.eventName}
              </span>
              {items.length > 0 && (
                <button onClick={handleSaveToEvent} disabled={saving}
                  title="Save schedule to this event"
                  className={cn(
                    'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors',
                    savedOk
                      ? 'text-moss-300 bg-moss-900/30 border border-moss-700/40'
                      : 'text-warm-500 hover:text-warm-300 hover:bg-warm-800 border border-transparent'
                  )}>
                  {savedOk
                    ? <><Check className="w-3 h-3" /> Saved</>
                    : <><Save className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}</>}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-moss-400' : 'bg-crimson-500')} />

          {features.canUseEditor && (
            <button onClick={() => setShowEditor(s => !s)}
              className={cn('ml-2 text-[11px] px-2.5 py-1 rounded transition-colors',
                showEditor ? 'bg-warm-800 text-warm-200' : 'text-warm-600 hover:text-warm-300 hover:bg-warm-900')}>
              {showEditor ? '← Timer' : 'Editor'}
            </button>
          )}

          {features.canUsePresenter && !showEditor && (
            <button onClick={() => setView('teleprompter')}
              className="text-[11px] px-2.5 py-1 rounded text-warm-700 hover:text-warm-400 hover:bg-warm-900 transition-colors">
              Presenter
            </button>
          )}

          <button onClick={() => setView('load')}
            className="text-[11px] px-2.5 py-1 rounded text-warm-700 hover:text-warm-400 hover:bg-warm-900 transition-colors">
            Load
          </button>

          {authUser ? (
            <div className="flex items-center gap-1.5 ml-1">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', PLAN_BADGE_COLOR[plan])}>
                {getPlanFeatures(plan).label}
              </span>
              <button onClick={() => navigate('/dashboard')}
                className="text-[11px] text-warm-600 hover:text-warm-300 transition-colors max-w-[80px] truncate">
                {authUser.user_metadata?.full_name || authUser.email?.split('@')[0]}
              </button>
              <button onClick={() => setShowProfile(true)} title="Account"
                className="text-warm-700 hover:text-warm-400 transition-colors">
                <UserCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="flex items-center gap-1 ml-1 text-[11px] px-2 py-1 rounded
                text-warm-600 hover:text-warm-300 hover:bg-warm-900 transition-colors">
              <LogIn className="w-3 h-3" /> Sign in
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {showEditor ? (
          <ScheduleEditor
            onClose={() => setShowEditor(false)}
            onSyncToSheets={spreadsheetId ? handleSyncToSheets : undefined}
            hasSheetsConnection={!!spreadsheetId && googleAuthenticated}
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
    </div>
  );
}
