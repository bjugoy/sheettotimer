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
    console.log('[auth] initialize — oauthCallback:', _oauthCallback, '| url:', window.location.href);

    let fallback: ReturnType<typeof setTimeout> | null = null;
    if (!_oauthCallback) {
      fallback = setTimeout(() => set(s => s.loading ? { loading: false } : s), 8000);
    }

    const clearFallback = () => { if (fallback) clearTimeout(fallback); };

    supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[auth] onAuthStateChange:', _event, '| user:', session?.user?.email ?? null);
      if (session?.user) {
        clearFallback();
        const plan = await fetchPlan(session.user.id);
        set({ user: session.user, session, plan, loading: false });
      } else if (!_oauthCallback) {
        clearFallback();
        set({ user: null, session: null, plan: 'free', loading: false });
      }
    });

    if (!_oauthCallback) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[auth] getSession result:', session?.user?.email ?? null);
        if (session?.user) {
          clearFallback();
          const plan = await fetchPlan(session.user.id);
          set({ user: session.user, session, plan, loading: false });
        }
      } catch (e) {
        console.error('[auth] getSession error:', e);
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
      options: { redirectTo: window.location.origin },
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
