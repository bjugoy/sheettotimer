import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Plus, Folder, CalendarDays, LogOut, ChevronRight, Trash2, Play } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getPlanFeatures, PLAN_BADGE_COLOR } from '../lib/plans';
import { cn } from '../utils/timeUtils';

interface Production {
  id: string;
  name: string;
  createdAt: number;
}

interface Event {
  id: string;
  productionId: string;
  name: string;
  createdAt: number;
}

const PRODS_KEY  = 'stt-productions';
const EVENTS_KEY = 'stt-events';

function loadProds(): Production[]  { try { return JSON.parse(localStorage.getItem(PRODS_KEY)  ?? '[]'); } catch { return []; } }
function loadEvents(): Event[]      { try { return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]'); } catch { return []; } }
function saveProds(p: Production[])  { localStorage.setItem(PRODS_KEY,  JSON.stringify(p)); }
function saveEvents(e: Event[])      { localStorage.setItem(EVENTS_KEY, JSON.stringify(e)); }

export function DashboardPage() {
  const navigate  = useNavigate();
  const user      = useAuthStore(s => s.user);
  const plan      = useAuthStore(s => s.plan);
  const signOut   = useAuthStore(s => s.signOut);
  const features  = getPlanFeatures(plan);
  const badgeCls  = PLAN_BADGE_COLOR[plan];

  const [prods, setProds]           = useState<Production[]>(loadProds);
  const [events, setEvents]         = useState<Event[]>(loadEvents);
  const [selectedProd, setSelected] = useState<string | null>(null);
  const [newProdName, setNewProd]   = useState('');
  const [newEventName, setNewEvent] = useState('');
  const [addingProd, setAddingProd] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);

  useEffect(() => { if (!user) navigate('/landing', { replace: true }); }, [user]);

  const currentProd   = prods.find(p => p.id === selectedProd);
  const currentEvents = events.filter(e => e.productionId === selectedProd);

  const createProd = () => {
    if (!newProdName.trim()) return;
    const p: Production = { id: crypto.randomUUID(), name: newProdName.trim(), createdAt: Date.now() };
    const next = [...prods, p];
    setProds(next); saveProds(next);
    setSelected(p.id);
    setNewProd(''); setAddingProd(false);
  };

  const deleteProd = (id: string) => {
    const nextP = prods.filter(p => p.id !== id);
    const nextE = events.filter(e => e.productionId !== id);
    setProds(nextP); saveProds(nextP);
    setEvents(nextE); saveEvents(nextE);
    if (selectedProd === id) setSelected(null);
  };

  const createEvent = () => {
    if (!newEventName.trim() || !selectedProd) return;
    const e: Event = { id: crypto.randomUUID(), productionId: selectedProd, name: newEventName.trim(), createdAt: Date.now() };
    const next = [...events, e];
    setEvents(next); saveEvents(next);
    setNewEvent(''); setAddingEvent(false);
  };

  const deleteEvent = (id: string) => {
    const next = events.filter(e => e.id !== id);
    setEvents(next); saveEvents(next);
  };

  const openEvent = (eventId: string, eventName: string) => {
    navigate('/app', { state: { from: 'dashboard', eventId, eventName } });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/landing', { replace: true });
  };

  const inputCls = 'w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-1.5 text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60 transition-colors';

  return (
    <div className="h-screen flex flex-col bg-warm-950">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-6 h-12
        border-b border-warm-800/40 bg-warm-900/60">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-crimson-400" />
          <span className="text-sm font-bold text-warm-200">SheetToTimer</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-[10px] px-2 py-0.5 rounded border', badgeCls)}>
            {getPlanFeatures(plan).label}
          </span>
          <span className="text-xs text-warm-600 max-w-[160px] truncate">
            {user?.user_metadata?.full_name || user?.email}
          </span>
          <button onClick={handleSignOut} title="Sign out"
            className="text-warm-700 hover:text-warm-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Split panel ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Productions panel */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-warm-800/40 bg-warm-900/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-800/30">
            <span className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Productions</span>
            <button onClick={() => { setAddingProd(true); setSelected(null); }}
              className="text-warm-700 hover:text-warm-400 transition-colors" title="New production">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {/* New production inline form */}
            {addingProd && (
              <div className="px-3 py-2 space-y-1.5">
                <input autoFocus value={newProdName} onChange={e => setNewProd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createProd(); if (e.key === 'Escape') { setAddingProd(false); setNewProd(''); } }}
                  placeholder="Production name" className={inputCls} />
                <div className="flex gap-1.5">
                  <button onClick={createProd}
                    className="flex-1 text-xs py-1 bg-crimson-800/60 hover:bg-crimson-700/60
                      border border-crimson-700/50 text-warm-200 rounded transition-colors">
                    Create
                  </button>
                  <button onClick={() => { setAddingProd(false); setNewProd(''); }}
                    className="text-xs px-2 py-1 text-warm-700 hover:text-warm-400 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {prods.length === 0 && !addingProd && (
              <div className="px-4 py-8 text-center">
                <Folder className="w-6 h-6 text-warm-800 mx-auto mb-2" />
                <p className="text-xs text-warm-700">No productions yet</p>
                <button onClick={() => setAddingProd(true)}
                  className="mt-2 text-xs text-crimson-500 hover:text-crimson-400 transition-colors">
                  + Create your first
                </button>
              </div>
            )}

            {prods.map(prod => (
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
                  onClick={e => { e.stopPropagation(); deleteProd(prod.id); }}
                  className="opacity-0 group-hover:opacity-100 text-warm-700 hover:text-crimson-400 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Events panel */}
        <main className="flex-1 flex flex-col min-w-0">
          {currentProd ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-warm-800/30">
                <div>
                  <h2 className="text-sm font-semibold text-warm-200">{currentProd.name}</h2>
                  <p className="text-[11px] text-warm-600">{currentEvents.length} event{currentEvents.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setAddingEvent(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-warm-800/60
                    hover:bg-warm-700/60 border border-warm-700/50 text-warm-300 rounded
                    transition-colors">
                  <Plus className="w-3 h-3" /> New event
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* New event inline form */}
                {addingEvent && (
                  <div className="mb-4 p-4 bg-warm-900/60 border border-warm-800/40 rounded-xl space-y-2">
                    <label className="text-[11px] text-warm-600">Event name</label>
                    <input autoFocus value={newEventName} onChange={e => setNewEvent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createEvent(); if (e.key === 'Escape') { setAddingEvent(false); setNewEvent(''); } }}
                      placeholder="e.g. Day 1 – Opening Ceremony" className={inputCls} />
                    <div className="flex gap-2 pt-1">
                      <button onClick={createEvent}
                        className="px-4 py-1.5 bg-crimson-800/60 hover:bg-crimson-700/60
                          border border-crimson-700/50 text-warm-200 text-xs rounded transition-colors">
                        Create event
                      </button>
                      <button onClick={() => { setAddingEvent(false); setNewEvent(''); }}
                        className="text-xs text-warm-700 hover:text-warm-400 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {currentEvents.length === 0 && !addingEvent && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <CalendarDays className="w-8 h-8 text-warm-800 mb-3" />
                    <p className="text-sm text-warm-600">No events in this production</p>
                    <p className="text-xs text-warm-700 mt-1 mb-4">Events are individual show days or programs.</p>
                    <button onClick={() => setAddingEvent(true)}
                      className="flex items-center gap-2 text-sm px-4 py-2 bg-crimson-800/60
                        hover:bg-crimson-700/60 border border-crimson-700/50 text-warm-200
                        rounded-lg transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add first event
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentEvents.map(event => (
                    <div key={event.id}
                      className="group bg-warm-900/60 border border-warm-800/40 rounded-xl p-4
                        hover:border-warm-700/60 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-medium text-warm-200">{event.name}</h3>
                          <p className="text-[10px] text-warm-700 mt-0.5">
                            {new Date(event.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button onClick={() => deleteEvent(event.id)}
                          className="opacity-0 group-hover:opacity-100 text-warm-700
                            hover:text-crimson-400 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => openEvent(event.id, event.name)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs
                          bg-crimson-800/50 hover:bg-crimson-700/50 border border-crimson-700/40
                          text-warm-200 rounded-lg transition-colors">
                        <Play className="w-3 h-3" /> Open timer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Folder className="w-10 h-10 text-warm-800 mb-3" />
              <h3 className="text-sm font-medium text-warm-500">Select a production</h3>
              <p className="text-xs text-warm-700 mt-1">
                Choose a production from the left, or create a new one.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
