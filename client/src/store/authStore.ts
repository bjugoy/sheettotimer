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

async function fetchPlan(userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return (data?.plan as Plan) ?? 'free';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  session: null,
  plan:    'free',
  loading: true,

  initialize: async () => {
    const fallback = setTimeout(() => set(s => s.loading ? { loading: false } : s), 8000);
    const clearFallback = () => clearTimeout(fallback);

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        clearFallback();
        // Use get().plan as fallback so a failing fetchPlan doesn't overwrite
        // a correct plan that getSession() may have already set.
        const plan = await fetchPlan(session.user.id).catch(() => get().plan);
        set({ user: session.user, session, plan, loading: false });
      } else if (event === 'SIGNED_OUT') {
        // During initialization, skip entirely — getSession() below is authoritative.
        // SIGNED_OUT can fire while Supabase is recovering an expired access token
        // (before the refresh completes), which would cause a spurious sign-out.
        if (get().loading) return;

        // Post-init: double-check before committing to sign-out — SIGNED_OUT also
        // fires spuriously when the page regains focus after a popup closes.
        const { data: { session: live } } = await supabase.auth.getSession()
          .catch(() => ({ data: { session: null } }));
        if (live?.user) {
          const plan = await fetchPlan(live.user.id).catch(() => get().plan);
          set({ user: live.user, session: live, plan, loading: false });
        } else {
          set({ user: null, session: null, plan: 'free', loading: false });
        }
      }
      // INITIAL_SESSION with null: do nothing here — getSession() below is authoritative.
    });

    if (!_oauthCallback) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        clearFallback();
        if (session?.user) {
          const plan = await fetchPlan(session.user.id).catch(() => get().plan);
          set({ user: session.user, session, plan, loading: false });
        } else {
          // Only clear if onAuthStateChange hasn't already signed us in
          // (e.g. TOKEN_REFRESHED fired while getSession() was awaiting).
          set(s => s.loading ? { user: null, session: null, plan: 'free', loading: false } : s);
        }
      } catch {
        // Unexpected error — unblock loading without signing out.
        clearFallback();
        set(s => s.loading ? { loading: false } : s);
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
