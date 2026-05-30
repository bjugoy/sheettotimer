import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Plan } from '../lib/plans';
import { supabase } from '../lib/supabase';
import { configureRC } from '../lib/revenuecat';

interface AuthState {
  user:           User | null;
  session:        Session | null;
  plan:           Plan;
  loading:        boolean;
  pendingPaywall: boolean;

  initialize:         () => Promise<void>;
  signIn:             (email: string, password: string) => Promise<string | null>;
  signUp:             (email: string, password: string, name: string) => Promise<string | null>;
  signInWithGoogle:   () => Promise<string | null>;
  signOut:            () => Promise<void>;
  updateDisplayName:  (name: string) => Promise<string | null>;
  deleteAccount:      () => Promise<string | null>;
  getToken:           () => string | null;
  clearPaywall:       () => void;
  setPlan:            (plan: Plan) => void;
  refreshPlan:        () => Promise<void>;
}

async function fetchPlan(userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return (data?.plan as Plan) ?? 'free';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:           null,
  session:        null,
  plan:           'free',
  loading:        true,
  pendingPaywall: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const plan = await fetchPlan(session.user.id);
      set({ user: session.user, session, plan, loading: false });
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        configureRC(session.user.id); // fire-and-forget — lazy loads RC SDK
        const plan = await fetchPlan(session.user.id);

        const emailPaywall = localStorage.getItem('stt-paywall') === '1';
        if (emailPaywall) localStorage.removeItem('stt-paywall');

        // New Google OAuth users: created_at ≈ last_sign_in_at (within 60s)
        const created     = new Date(session.user.created_at).getTime();
        const lastSignIn  = new Date(session.user.last_sign_in_at ?? session.user.created_at).getTime();
        const isNewGoogle = _event === 'SIGNED_IN'
          && session.user.app_metadata?.provider === 'google'
          && Math.abs(lastSignIn - created) < 60_000;

        set({ user: session.user, session, plan, pendingPaywall: emailPaywall || isNewGoogle });
      } else {
        set({ user: null, session: null, plan: 'free', pendingPaywall: false });
      }
    });
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

  updateDisplayName: async (name) => {
    const { error, data } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) return error.message;
    if (data.user) set({ user: data.user });
    return null;
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return error.message;
    await supabase.auth.signOut();
    set({ user: null, session: null, plan: 'free' });
    return null;
  },

  signOut: async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore network errors */ }
    set({ user: null, session: null, plan: 'free' });
  },

  getToken:     () => get().session?.access_token ?? null,
  clearPaywall: () => set({ pendingPaywall: false }),
  setPlan:      (plan) => set({ plan }),
  refreshPlan:  async () => {
    const { user } = get();
    if (!user) return;
    const plan = await fetchPlan(user.id);
    set({ plan });
  },
}));
