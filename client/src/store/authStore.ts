import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Plan } from '../lib/plans';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

interface AuthState {
  user:    User | null;
  session: Session | null;
  plan:    Plan;
  loading: boolean;

  initialize:        () => Promise<void>;
  signIn:            (email: string, password: string) => Promise<string | null>;
  signUp:            (email: string, password: string, name: string) => Promise<string | null>;
  signInWithGoogle:  () => Promise<string | null>;
  resetPassword:     (email: string) => Promise<string | null>;
  signOut:           () => Promise<void>;
  updateDisplayName: (name: string) => Promise<string | null>;
  deleteAccount:     () => Promise<string | null>;
  getToken:          () => string | null;
  setPlan:           (plan: Plan) => void;
  refreshPlan:       () => Promise<void>;
}

// Captured at module-load time before React or Supabase can strip OAuth
// params from the URL. Used to detect an in-flight OAuth callback so we
// don't mark auth as "done" (loading:false, user:null) before SIGNED_IN fires.
const _oauthCallback =
  window.location.hash.includes('access_token') ||
  new URLSearchParams(window.location.search).has('code');

// Read the Supabase session synchronously from localStorage at module-load time.
// This eliminates the flash-of-null-user on refresh: the store is pre-seeded
// with the stored user before any async initialization runs.
function _readStoredSession(): Session | null {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.access_token && parsed?.user) ? parsed as Session : null;
  } catch { return null; }
}

const _storedSession = _oauthCallback ? null : _readStoredSession();

async function fetchPlan(userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return (data?.plan as Plan) ?? 'free';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Pre-seed from localStorage so the user is never null on a page refresh.
  // initialize() will verify and refresh the token in the background.
  user:    _storedSession?.user ?? null,
  session: _storedSession       ?? null,
  plan:    'free',
  loading: true,

  initialize: async () => {
    // No stored session and no OAuth callback — definitely not logged in.
    if (!_storedSession && !_oauthCallback) {
      set({ loading: false });
      return;
    }

    let fallback: ReturnType<typeof setTimeout> | null = null;
    if (!_oauthCallback) {
      fallback = setTimeout(() => set(s => s.loading ? { loading: false } : s), 8000);
    }

    const clearFallback = () => { if (fallback) clearTimeout(fallback); };

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        clearFallback();
        const plan = await fetchPlan(session.user.id).catch(() => 'free' as Plan);
        set({ user: session.user, session, plan, loading: false });
      } else if (event === 'SIGNED_OUT') {
        // Double-check before signing out — SIGNED_OUT fires spuriously on page
        // focus when a popup closes and the token refresh races.
        const { data: { session: live } } = await supabase.auth.getSession()
          .catch(() => ({ data: { session: null } }));
        if (live?.user) {
          const plan = await fetchPlan(live.user.id).catch(() => 'free' as Plan);
          set({ user: live.user, session: live, plan, loading: false });
        } else {
          clearFallback();
          set({ user: null, session: null, plan: 'free', loading: false });
        }
      }
      // INITIAL_SESSION with null: don't act — getSession() below is authoritative.
    });

    if (!_oauthCallback) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        clearFallback();
        if (session?.user) {
          const plan = await fetchPlan(session.user.id).catch(() => 'free' as Plan);
          set({ user: session.user, session, plan, loading: false });
        } else {
          // Session expired/revoked — only clear if we haven't already been
          // signed in by a concurrent INITIAL_SESSION/SIGNED_IN event.
          set(s => s.loading ? { user: null, session: null, plan: 'free', loading: false } : s);
        }
      } catch {
        // Network error during token refresh — unblock loading but keep the
        // stored user rather than signing them out for a transient failure.
        clearFallback();
        set({ loading: false });
      }
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signUp: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return error?.message ?? null;
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://sheettotimer.com' },
    });
    return error?.message ?? null;
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return error?.message ?? null;
  },

  updateDisplayName: async (name) => {
    const { error, data } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) return error.message;
    if (data.user) set({ user: data.user });
    return null;
  },

  deleteAccount: async () => {
    const token = get().session?.access_token;
    if (!token) return 'Not signed in';

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(apiUrl('/api/account'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 401) {
        // Token already invalid — account was likely deleted in a previous attempt
        // that didn't clean up the client. Treat as success and clear local state.
        supabase.auth.signOut().catch(() => {});
        set({ user: null, session: null, plan: 'free' });
        return null;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        return (data as { error?: string }).error ?? 'Failed to delete account';
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        return 'Request timed out — please try again';
      }
      return 'Network error — please try again';
    }

    // Fire-and-forget — don't block on Supabase's server call (it can throw if
    // the user record was just removed, which would leave deleteLoading stuck)
    supabase.auth.signOut().catch(() => {});
    set({ user: null, session: null, plan: 'free' });
    return null;
  },

  signOut: async () => {
    // Fire-and-forget — don't block navigation on the server round-trip
    supabase.auth.signOut().catch(() => {});
    set({ user: null, session: null, plan: 'free' });
  },

  getToken:    () => get().session?.access_token ?? null,
  setPlan:     (plan) => set({ plan }),
  refreshPlan: async () => {
    const { user } = get();
    if (!user) return;
    const plan = await fetchPlan(user.id);
    set({ plan });
  },
}));
