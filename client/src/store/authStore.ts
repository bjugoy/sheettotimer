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

  initialize:  () => Promise<void>;
  signIn:      (email: string, password: string) => Promise<string | null>;
  signUp:      (email: string, password: string, name: string) => Promise<string | null>;
  signOut:     () => Promise<void>;
  getToken:     () => string | null;
  clearPaywall: () => void;
  setPlan:      (plan: Plan) => void;
  refreshPlan:  () => Promise<void>;
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
        configureRC(session.user.id);
        const plan = await fetchPlan(session.user.id);
        const showPaywall = localStorage.getItem('stt-paywall') === '1';
        if (showPaywall) localStorage.removeItem('stt-paywall');
        set({ user: session.user, session, plan, pendingPaywall: showPaywall });
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

  signOut: async () => {
    await supabase.auth.signOut();
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
