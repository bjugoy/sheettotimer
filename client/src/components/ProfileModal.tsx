import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Radio, Mail, CreditCard, Trash2, Check, Pencil, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useScheduleStore } from '../store/scheduleStore';
import { getPlanFeatures, PLAN_BADGE_COLOR } from '../lib/plans';
import { startCheckout, openBillingPortal } from '../lib/billing';
import { cn } from '../utils/timeUtils';

interface Props {
  onClose: () => void;
}

const PLAN_DESCRIPTION = {
  free:     'Upload & timer view only',
  premium1: 'Google Sheets · Editor · Room for 5 · Presenter',
  premium2: 'Google Sheets · Editor · Room for 15 · Presenter · Custom columns',
} as const;

export function ProfileModal({ onClose }: Props) {
  const navigate          = useNavigate();
  const user              = useAuthStore(s => s.user);
  const plan              = useAuthStore(s => s.plan);
  const signOut           = useAuthStore(s => s.signOut);
  const clearSchedule     = useScheduleStore(s => s.clearAll);
  const liveItems         = useScheduleStore(s => s.items);
  const activeEventId     = useScheduleStore(s => s.activeEventId);
  const timerStates       = useScheduleStore(s => s.timerStates);

  // A timer is "live" if the active event has a running item, or any saved
  // timer state has an active item (background events)
  const activeLiveCount = [
    liveItems.some(i => i.status === 'active') ? activeEventId : null,
    ...Object.entries(timerStates)
      .filter(([id, s]) => id !== activeEventId && s.items.some(i => i.status === 'active'))
      .map(([id]) => id),
  ].filter(Boolean).length;
  const getToken          = useAuthStore(s => s.getToken);
  const updateDisplayName = useAuthStore(s => s.updateDisplayName);
  const deleteAccount     = useAuthStore(s => s.deleteAccount);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue]     = useState(user?.user_metadata?.full_name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError]     = useState('');

  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [deleteError, setDeleteError]       = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [billingLoading, setBillingLoading] = useState<'pro' | 'studio' | 'portal' | null>(null);
  const [billingError, setBillingError]     = useState('');

  const planFeatures = getPlanFeatures(plan);
  const badgeCls     = PLAN_BADGE_COLOR[plan];
  const provider     = user?.app_metadata?.provider as string | undefined;
  const isGoogle     = provider === 'google';

  const displayName  = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '?';
  const initials     = displayName
    .split(' ')
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setNameError('');
    setNameLoading(true);
    const err = await updateDisplayName(nameValue.trim());
    setNameLoading(false);
    if (err) { setNameError(err); return; }
    setEditingName(false);
  };

  const handleDelete = async () => {
    setDeleteError('');
    setDeleteLoading(true);
    const err = await deleteAccount();
    setDeleteLoading(false);
    if (err) { setDeleteError(err); return; }
    onClose();
    navigate('/landing', { replace: true });
  };

  const doSignOut = async () => {
    await signOut();
    clearSchedule();
    onClose();
    navigate('/landing', { replace: true });
  };

  const handleSignOut = () => {
    if (activeLiveCount > 0) {
      setConfirmSignOut(true);
    } else {
      void doSignOut();
    }
  };

  const handleUpgrade = async (targetPlan: 'premium1' | 'premium2') => {
    const token = getToken();
    if (!token) { setBillingError('Not signed in'); return; }
    setBillingError('');
    setBillingLoading(targetPlan === 'premium1' ? 'pro' : 'studio');
    try {
      await startCheckout(targetPlan, token);
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Something went wrong');
      setBillingLoading(null);
    }
  };

  const handlePortal = async () => {
    const token = getToken();
    if (!token) { setBillingError('Not signed in'); return; }
    setBillingError('');
    setBillingLoading('portal');
    try {
      await openBillingPortal(token);
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Something went wrong');
      setBillingLoading(null);
    }
  };

  const inputCls = 'w-full bg-warm-800/60 border border-warm-700/50 rounded-lg px-3 py-1.5 text-sm text-warm-200 placeholder-warm-700 focus:outline-none focus:border-crimson-700/60 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-warm-900 border border-warm-800/60 rounded-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-warm-800/40">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-crimson-400" />
            <span className="text-sm font-semibold text-warm-200">Account</span>
          </div>
          <button onClick={onClose} className="text-warm-500 hover:text-warm-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Avatar + identity */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-crimson-800/60 border border-crimson-700/40
              flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-crimson-200 tracking-wide">{initials}</span>
            </div>
            <div className="min-w-0">
              {editingName ? (
                <div className="space-y-1.5">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') { setEditingName(false); setNameValue(user?.user_metadata?.full_name ?? ''); }
                    }}
                    className={inputCls}
                    placeholder="Display name"
                  />
                  {nameError && <p className="text-[10px] text-crimson-300">{nameError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveName}
                      disabled={nameLoading}
                      className="text-[11px] px-2.5 py-1 bg-crimson-800/60 hover:bg-crimson-700/60
                        border border-crimson-700/50 text-warm-200 rounded transition-colors disabled:opacity-50">
                      {nameLoading ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameValue(user?.user_metadata?.full_name ?? ''); }}
                      className="text-[11px] text-warm-400 hover:text-warm-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-warm-200 truncate">{displayName}</span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-warm-500 hover:text-warm-200 transition-colors shrink-0">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-warm-500 shrink-0" />
                <span className="text-[11px] text-warm-400 truncate">{user?.email}</span>
              </div>
              <div className="mt-1">
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded border font-medium tracking-wide uppercase',
                  isGoogle
                    ? 'text-blue-300/80 bg-blue-900/20 border-blue-800/30'
                    : 'text-warm-400 bg-warm-800/50 border-warm-700/40'
                )}>
                  {isGoogle ? 'via Google' : 'Email account'}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="space-y-2 pt-1 border-t border-warm-800/40">
            <p className="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Subscription</p>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', badgeCls)}>
                {planFeatures.label}
              </span>
              <span className="text-xs text-warm-400">{PLAN_DESCRIPTION[plan]}</span>
            </div>

            {billingError && (
              <p className="text-[10px] text-crimson-300">{billingError}</p>
            )}

            {plan === 'free' ? (
              <div className="space-y-1.5 pt-0.5">
                <button
                  onClick={() => handleUpgrade('premium1')}
                  disabled={!!billingLoading}
                  className="w-full flex items-center justify-between px-3 py-2
                    bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/40
                    hover:border-amber-600/50 rounded-lg transition-colors disabled:opacity-50">
                  <div className="flex items-center gap-2">
                    {billingLoading === 'pro'
                      ? <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                      : <Check className="w-3.5 h-3.5 text-amber-300" />}
                    <span className="text-xs font-medium text-amber-200">Pro</span>
                  </div>
                  <span className="text-[11px] text-amber-400">$8.99 / mo</span>
                </button>
                <button
                  onClick={() => handleUpgrade('premium2')}
                  disabled={!!billingLoading}
                  className="w-full flex items-center justify-between px-3 py-2
                    bg-crimson-900/20 hover:bg-crimson-900/30 border border-crimson-700/40
                    hover:border-crimson-600/50 rounded-lg transition-colors disabled:opacity-50">
                  <div className="flex items-center gap-2">
                    {billingLoading === 'studio'
                      ? <Loader2 className="w-3.5 h-3.5 text-crimson-300 animate-spin" />
                      : <Check className="w-3.5 h-3.5 text-crimson-300" />}
                    <span className="text-xs font-medium text-crimson-200">Studio</span>
                  </div>
                  <span className="text-[11px] text-crimson-400">$14.99 / mo</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handlePortal}
                disabled={!!billingLoading}
                className="w-full flex items-center justify-center gap-2 py-2 mt-1
                  bg-warm-800/40 hover:bg-warm-800/70 border border-warm-700/40
                  hover:border-warm-600/60 rounded-lg text-xs text-warm-300
                  transition-colors disabled:opacity-50">
                {billingLoading === 'portal'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CreditCard className="w-3.5 h-3.5" />}
                Manage billing
              </button>
            )}
          </div>

          {/* Danger zone */}
          <div className="space-y-2 pt-1 border-t border-warm-800/40">
            <p className="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Account</p>

            {confirmDelete ? (
              <div className="space-y-3 p-3 bg-crimson-950/60 border border-crimson-800/40 rounded-lg">
                <p className="text-xs text-warm-400 leading-relaxed">
                  This will permanently delete your account and all productions.
                  This action cannot be undone.
                </p>
                {deleteError && <p className="text-[10px] text-crimson-300">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex-1 py-1.5 bg-crimson-700/60 hover:bg-crimson-600/60
                      border border-crimson-600/50 text-warm-100 text-xs rounded transition-colors disabled:opacity-50">
                    {deleteLoading ? '…' : 'Yes, delete my account'}
                  </button>
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteError(''); }}
                    className="px-3 py-1.5 text-xs text-warm-400 hover:text-warm-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 py-2 px-3
                  text-warm-400 hover:text-crimson-300 hover:bg-crimson-950/40
                  border border-transparent hover:border-crimson-800/30
                  rounded-lg text-xs transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Delete account
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          {confirmSignOut ? (
            <div className="space-y-3 p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg">
              <p className="text-xs text-warm-300 leading-relaxed">
                {activeLiveCount === 1
                  ? 'You have a live timer running.'
                  : `You have ${activeLiveCount} live timers running.`}
                {' '}Signing out will stop {activeLiveCount === 1 ? 'it' : 'them'}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void doSignOut()}
                  className="flex-1 py-1.5 bg-warm-800/60 hover:bg-warm-700/60
                    border border-warm-700/50 text-warm-200 text-xs rounded transition-colors">
                  Sign out anyway
                </button>
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="px-3 py-1.5 text-xs text-warm-400 hover:text-warm-200 transition-colors">
                  Keep running
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full py-2 border border-warm-700/50 rounded-lg text-xs
                text-warm-400 hover:text-warm-200 hover:border-warm-600/60 transition-colors">
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
