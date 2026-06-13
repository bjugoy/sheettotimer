import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, Plus, Folder, CalendarDays,
  ChevronRight, Trash2, Play, Loader2, UserCircle,
  ArrowLeft, LogIn,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useScheduleStore } from '../store/scheduleStore';
import { getPlanFeatures, PLAN_BADGE_COLOR } from '../lib/plans';
import {
  getProductions, createProduction, deleteProduction,
  getEvents, createEvent, deleteEvent,
} from '../lib/db';
import type { Production, Event } from '../lib/db';
import { cn } from '../utils/timeUtils';
import { ProfileModal } from '../components/ProfileModal';

// Survive navigation: keep the last-loaded list so the dashboard shows
// immediately on return instead of showing a spinner while re-fetching.
let _prodsCache: Production[] | null = null;
let _eventsCache: { prodId: string; events: Event[] } | null = null;

export function DashboardPage() {
  const navigate    = useNavigate();
  const user        = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  const plan        = useAuthStore(s => s.plan);
  const features    = getPlanFeatures(plan);
  const badgeCls    = PLAN_BADGE_COLOR[plan];

  const liveEventId = useScheduleStore(s => s.activeEventId);
  const storeItems  = useScheduleStore(s => s.items);
  const isLive      = storeItems.some(i => i.status === 'active');

  const [showProfile, setShowProfile] = useState(false);
  const [showJoin,    setShowJoin]    = useState(false);
  const [joinCode,    setJoinCode]    = useState('');
  const [joinName,    setJoinName]    = useState(
    () => user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [prods, setProds]           = useState<Production[]>(_prodsCache ?? []);
  const [events, setEvents]         = useState<Event[]>(_eventsCache?.events ?? []);
  const [selectedProd, setSelected] = useState<string | null>(_eventsCache?.prodId ?? null);
  const [loadingProds, setLoadingProds]   = useState(_prodsCache === null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [newProdName, setNewProd]   = useState('');
  const [newEventName, setNewEvent] = useState('');
  const [addingProd, setAddingProd]   = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [pendingDeleteProd,  setPendingDeleteProd]  = useState<string | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || user) return;
    // Small grace period: SIGNED_OUT can fire transiently (e.g. after a popup
    // closes and the page regains focus). Wait 1.5 s to let getSession() resolve
    // before committing to redirect.
    const t = setTimeout(() => navigate('/landing', { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [user, authLoading]);

  // ── Load productions ───────────────────────────────────────────────────────
  const loadProds = useCallback(async () => {
    if (_prodsCache === null) setLoadingProds(true);
    try {
      const data = await getProductions();
      _prodsCache = data;
      setProds(data);
    } catch (e) { setError(`Failed to load productions: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setLoadingProds(false); }
  }, []);

  useEffect(() => { if (user) loadProds(); }, [user]);

  // ── Load events when production selected ──────────────────────────────────
  useEffect(() => {
    if (!selectedProd) { setEvents([]); _eventsCache = null; return; }
    if (_eventsCache?.prodId === selectedProd) return; // already cached
    setLoadingEvents(true);
    getEvents(selectedProd)
      .then(data => { _eventsCache = { prodId: selectedProd, events: data }; setEvents(data); })
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoadingEvents(false));
  }, [selectedProd]);

  const currentProd   = prods.find(p => p.id === selectedProd);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleCreateProd = async () => {
    if (!newProdName.trim()) return;
    setSaving(true);
    try {
      const p = await createProduction(newProdName.trim());
      setProds(prev => { _prodsCache = [p, ...prev]; return _prodsCache; });
      setSelected(p.id);
      setNewProd(''); setAddingProd(false);
    } catch (e) { setError(`Failed to create production: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSaving(false); }
  };

  const handleDeleteProd = (id: string) => setPendingDeleteProd(id);

  const confirmDeleteProd = async () => {
    if (!pendingDeleteProd) return;
    const id = pendingDeleteProd;
    setPendingDeleteProd(null);
    try {
      await deleteProduction(id);
      setProds(prev => { _prodsCache = prev.filter(p => p.id !== id); return _prodsCache; });
      setEvents(prev => { const next = prev.filter(e => e.production_id !== id); if (_eventsCache?.prodId === id) _eventsCache = null; return next; });
      if (selectedProd === id) setSelected(null);
    } catch { setError('Failed to delete production'); }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim() || !selectedProd) return;
    setSaving(true);
    try {
      const e = await createEvent(selectedProd, newEventName.trim());
      setEvents(prev => { const next = [...prev, e]; if (_eventsCache?.prodId === selectedProd) _eventsCache = { prodId: selectedProd, events: next }; return next; });
      setNewEvent(''); setAddingEvent(false);
    } catch { setError('Failed to create event'); }
    finally { setSaving(false); }
  };

  const handleDeleteEvent = (id: string) => setPendingDeleteEvent(id);

  const confirmDeleteEvent = async () => {
    if (!pendingDeleteEvent) return;
    const id = pendingDeleteEvent;
    setPendingDeleteEvent(null);
    try {
      await deleteEvent(id);
      setEvents(prev => { const next = prev.filter(e => e.id !== id); if (_eventsCache) _eventsCache = { ..._eventsCache, events: next }; return next; });
    } catch { setError('Failed to delete event'); }
  };

  const openEvent = (event: Event) => {
    navigate('/app', { state: { from: 'dashboard', eventId: event.id, eventName: event.name } });
  };

  const inputCls = 'w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-1.5 text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60 transition-colors';

  return (
    <div className="h-screen flex flex-col bg-warm-950">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-warm-800/40 bg-warm-900/60">
        <div className="flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-crimson-400" />
              <span className="text-sm font-bold text-warm-200">SheetToTimer</span>
            </div>
            <span className="text-warm-800">·</span>
            <button onClick={() => navigate('/landing', { replace: true })}
              className="flex items-center gap-1.5 text-xs text-warm-600 hover:text-warm-300 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJoin(s => !s)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium',
                showJoin
                  ? 'bg-warm-700 text-warm-100 border-warm-600'
                  : 'text-warm-300 border-warm-700/60 hover:bg-warm-800 hover:text-warm-100'
              )}>
              <LogIn className="w-3.5 h-3.5" />
              Join Room
            </button>
            <button onClick={() => setShowProfile(true)}
              className={cn('text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:brightness-125', badgeCls)}>
              {getPlanFeatures(plan).label}
            </button>
            <button onClick={() => setShowProfile(true)}
              className="flex items-center gap-1.5 text-xs text-warm-600 hover:text-warm-300 transition-colors max-w-[140px]">
              <UserCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{user?.user_metadata?.full_name || user?.email}</span>
            </button>
          </div>
        </div>

        {/* Join Room inline panel */}
        {showJoin && (
          <div className="px-6 py-3 bg-warm-900/80 border-t border-warm-800/40 flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-warm-600 uppercase tracking-wider">Room code</label>
              <input
                autoFocus
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && joinCode.length === 6 && joinName.trim()) {
                    navigate('/app', { state: { joinCode: joinCode.trim(), joinName: joinName.trim() } });
                  }
                  if (e.key === 'Escape') setShowJoin(false);
                }}
                placeholder="XXXXXX"
                className="w-32 bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-1.5
                  text-sm text-warm-100 font-mono tracking-[0.2em] text-center placeholder-warm-700
                  focus:outline-none focus:border-crimson-700/60 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-warm-600 uppercase tracking-wider">Your name</label>
              <input
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                placeholder="Name"
                className="w-40 bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-1.5
                  text-sm text-warm-200 placeholder-warm-700
                  focus:outline-none focus:border-crimson-700/60 transition-colors"
              />
            </div>
            <button
              onClick={() => navigate('/app', { state: { joinCode: joinCode.trim(), joinName: joinName.trim() } })}
              disabled={joinCode.length !== 6 || !joinName.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-crimson-800/60 hover:bg-crimson-700/60
                disabled:opacity-40 disabled:cursor-not-allowed border border-crimson-700/50
                rounded-lg text-sm font-medium text-warm-100 transition-colors">
              <LogIn className="w-3.5 h-3.5" /> Join
            </button>
            <button onClick={() => setShowJoin(false)}
              className="text-xs text-warm-700 hover:text-warm-400 transition-colors pb-1.5">
              Cancel
            </button>
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-6 py-2 bg-crimson-900/40 border-b border-crimson-800/40
          flex items-center justify-between">
          <span className="text-xs text-crimson-300">{error}</span>
          <button onClick={() => setError(null)} className="text-crimson-600 hover:text-crimson-400 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* ── Split panel ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Productions sidebar */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-warm-800/40 bg-warm-900/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-800/30">
            <span className="text-xs font-semibold text-warm-500 uppercase tracking-wider">
              Productions
            </span>
            <button
              onClick={() => setAddingProd(true)}
              className="text-warm-700 hover:text-warm-400 transition-colors"
              title="New production">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {addingProd && (
              <div className="px-3 py-2 space-y-1.5">
                <input autoFocus value={newProdName} onChange={e => setNewProd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateProd(); if (e.key === 'Escape') { setAddingProd(false); setNewProd(''); } }}
                  placeholder="Production name" className={inputCls} />
                <div className="flex gap-1.5">
                  <button onClick={handleCreateProd} disabled={saving}
                    className="flex-1 text-xs py-1 bg-crimson-800/60 hover:bg-crimson-700/60
                      border border-crimson-700/50 text-warm-200 rounded transition-colors disabled:opacity-50">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Create'}
                  </button>
                  <button onClick={() => { setAddingProd(false); setNewProd(''); }}
                    className="text-xs px-2 py-1 text-warm-700 hover:text-warm-400 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingProds ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 text-warm-700 animate-spin" />
              </div>
            ) : prods.length === 0 && !addingProd ? (
              <div className="px-4 py-8 text-center">
                <Folder className="w-6 h-6 text-warm-800 mx-auto mb-2" />
                <p className="text-xs text-warm-700">No productions yet</p>
                <button onClick={() => setAddingProd(true)}
                  className="mt-2 text-xs text-crimson-500 hover:text-crimson-400 transition-colors">
                  + Create your first
                </button>
              </div>
            ) : (
              prods.map(prod => (
                <div key={prod.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                    selectedProd === prod.id
                      ? 'bg-warm-800/60 text-warm-200'
                      : 'text-warm-500 hover:bg-warm-800/30 hover:text-warm-300'
                  )}
                  onClick={() => setSelected(prod.id)}>
                  <ChevronRight className={cn('w-3 h-3 flex-shrink-0 transition-transform',
                    selectedProd === prod.id && 'rotate-90')} />
                  <span className="flex-1 text-sm truncate">{prod.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteProd(prod.id); }}
                    className="opacity-0 group-hover:opacity-100 text-warm-700 hover:text-crimson-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Events panel */}
        <main className="flex-1 flex flex-col min-w-0">
          {currentProd ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-warm-800/30">
                <div>
                  <h2 className="text-sm font-semibold text-warm-200">{currentProd.name}</h2>
                  <p className="text-[11px] text-warm-600">
                    {loadingEvents ? 'Loading…' : `${events.length} event${events.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => setAddingEvent(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-warm-800/60
                    hover:bg-warm-700/60 border border-warm-700/50 text-warm-300 rounded transition-colors">
                  <Plus className="w-3 h-3" />
                  New event
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {addingEvent && (
                  <div className="mb-4 p-4 bg-warm-900/60 border border-warm-800/40 rounded-xl space-y-2">
                    <label className="text-[11px] text-warm-600">Event name</label>
                    <input autoFocus value={newEventName} onChange={e => setNewEvent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateEvent(); if (e.key === 'Escape') { setAddingEvent(false); setNewEvent(''); } }}
                      placeholder="e.g. Day 1 – Opening Ceremony" className={inputCls} />
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleCreateEvent} disabled={saving}
                        className="px-4 py-1.5 bg-crimson-800/60 hover:bg-crimson-700/60
                          border border-crimson-700/50 text-warm-200 text-xs rounded transition-colors disabled:opacity-50">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create event'}
                      </button>
                      <button onClick={() => { setAddingEvent(false); setNewEvent(''); }}
                        className="text-xs text-warm-700 hover:text-warm-400 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {loadingEvents ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-5 h-5 text-warm-700 animate-spin" />
                  </div>
                ) : events.length === 0 && !addingEvent ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <CalendarDays className="w-8 h-8 text-warm-800 mb-3" />
                    <p className="text-sm text-warm-600">No events in this production</p>
                    <p className="text-xs text-warm-700 mt-1 mb-4">
                      Each event is a single show day with its own schedule.
                    </p>
                    <button onClick={() => setAddingEvent(true)}
                      className="flex items-center gap-2 text-sm px-4 py-2 bg-crimson-800/60
                        hover:bg-crimson-700/60 border border-crimson-700/50 text-warm-200
                        rounded-lg transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add first event
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {events.map(event => (
                      <div key={event.id}
                        className="group bg-warm-900/60 border border-warm-800/40 rounded-xl p-4
                          hover:border-warm-700/60 transition-colors">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="text-sm font-medium text-warm-200 truncate">{event.name}</h3>
                            {isLive && event.id === liveEventId && (
                              <span className="shrink-0 text-[9px] font-bold tracking-widest uppercase
                                text-crimson-400 animate-pulse">● live</span>
                            )}
                          </div>
                          <button onClick={() => handleDeleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 text-warm-700
                              hover:text-crimson-400 transition-all ml-2 flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-warm-400 mb-3">
                          {event.schedule.length > 0
                            ? `${event.schedule.length} items saved`
                            : 'No schedule yet'}
                          {' · '}
                          {new Date(event.created_at).toLocaleDateString()}
                        </p>
                        <button onClick={() => openEvent(event)}
                          className={cn(
                            'w-full flex items-center justify-center gap-2 py-2 text-xs',
                            'border rounded-lg transition-colors text-warm-200',
                            isLive && event.id === liveEventId
                              ? 'bg-crimson-700/50 hover:bg-crimson-600/50 border-crimson-600/60'
                              : 'bg-crimson-800/50 hover:bg-crimson-700/50 border-crimson-700/40'
                          )}>
                          <Play className="w-3 h-3" />
                          {isLive && event.id === liveEventId
                            ? 'Back to timer'
                            : event.schedule.length > 0 ? 'Open timer' : 'Upload schedule'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Folder className="w-10 h-10 text-warm-800 mb-3" />
              <h3 className="text-sm font-medium text-warm-500">Select a production</h3>
              <p className="text-xs text-warm-700 mt-1">
                Choose a production on the left, or create a new one.
              </p>
            </div>
          )}
        </main>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {/* ── Delete production confirmation ──────────────────────────────────── */}
      {pendingDeleteProd && (() => {
        const prod = prods.find(p => p.id === pendingDeleteProd);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-700/60 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-warm-100 mb-1">Delete production?</h3>
              <p className="text-xs text-warm-500 mb-4">
                <span className="text-warm-300">"{prod?.name}"</span> and all its events will be permanently deleted.
                This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteProd}
                  className="flex-1 py-2 text-xs bg-crimson-800/70 hover:bg-crimson-700/70
                    border border-crimson-700/50 text-crimson-200 rounded-lg transition-colors">
                  Yes, delete
                </button>
                <button
                  onClick={() => setPendingDeleteProd(null)}
                  className="flex-1 py-2 text-xs bg-warm-800/60 hover:bg-warm-700/60
                    border border-warm-700/50 text-warm-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete event confirmation ────────────────────────────────────────── */}
      {pendingDeleteEvent && (() => {
        const evt = events.find(e => e.id === pendingDeleteEvent);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-700/60 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-warm-100 mb-1">Delete event?</h3>
              <p className="text-xs text-warm-500 mb-4">
                <span className="text-warm-300">"{evt?.name}"</span> and its schedule will be permanently deleted.
                This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteEvent}
                  className="flex-1 py-2 text-xs bg-crimson-800/70 hover:bg-crimson-700/70
                    border border-crimson-700/50 text-crimson-200 rounded-lg transition-colors">
                  Yes, delete
                </button>
                <button
                  onClick={() => setPendingDeleteEvent(null)}
                  className="flex-1 py-2 text-xs bg-warm-800/60 hover:bg-warm-700/60
                    border border-warm-700/50 text-warm-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
