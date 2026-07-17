import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Plan } from '../lib/plans';
import { supabase, SITE_ORIGIN } from '../lib/supabase';
import { apiUrl } from '../lib/api';

interface AuthState {
  user:                User | null;
  session:             Session | null;
  plan:                Plan;
  loading:             boolean;
  needsPasswordReset:  boolean;
  authLinkError:       string | null;
  clearAuthLinkError:  () => void;

  initialize:        () => Promise<void>;
  signIn:            (email: string, password: string) => Promise<string | null>;
  signUp:            (email: string, password: string, name: string) => Promise<string | null>;
  signInWithGoogle:  () => Promise<string | null>;
  resetPassword:     (email: string) => Promise<string | null>;
  updatePassword:    (password: string) => Promise<string | null>;
  signOut:           () => Promise<void>;
  updateDisplayName: (name: string) => Promise<string | null>;
  deleteAccount:     () => Promise<string | null>;
  getToken:          () => string | null;
  setPlan:           (plan: Plan) => void;
  refreshPlan:       () => Promise<void>;
}

// Captured at module-load time before React or Supabase can strip URL params.
// _recoveryPending: user clicked a password-reset link — must show reset form.
// _oauthCallback:   PKCE OAuth code in-flight — skip getSession() to avoid
//                   consuming the code before onAuthStateChange fires SIGNED_IN.
//                   Hash-based tokens (#access_token) are NOT excluded here:
//                   they require getSession() to be called so Supabase processes
//                   the hash and fires PASSWORD_RECOVERY / SIGNED_IN.
let _recoveryPending = window.location.hash.includes('type=recovery');
const _oauthCallback = new URLSearchParams(window.location.search).has('code');

// Expired or already-consumed email links (confirmation / password reset) come
// back from Supabase's verify endpoint as
//   #error=access_denied&error_code=otp_expired&error_description=...
// with no access_token. Without handling, the app silently shows the landing
// page. Capture the message for display and clean the hash from the URL.
const _hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const _linkError = !_hashParams.has('access_token') && _hashParams.has('error')
  ? (_hashParams.get('error_description') ?? 'This link is invalid or has expired.')
  : null;
if (_linkError) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

async function fetchPlan(userId: string): Promise<Plan> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return (data?.plan as Plan) ?? 'free';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:               null,
  session:            null,
  plan:               'free',
  loading:            true,
  needsPasswordReset: false,
  authLinkError:      _linkError,
  clearAuthLinkError: () => set({ authLinkError: null }),

  initialize: async () => {
    const fallback = setTimeout(() => set(s => s.loading ? { loading: false } : s), 8000);
    const clearFallback = () => clearTimeout(fallback);

    supabase.auth.onAuthStateChange((event, session) => {
      // IMPORTANT: this callback must be synchronous — no Supabase client calls
      // (getSession, DB queries) inside here. In Supabase ≥2.x, those calls
      // await _initializePromise, which in some versions is still pending when
      // this callback fires. Calling them here causes a deadlock that hangs
      // getSession(), getProductions(), and any other Supabase call on the page.

      // Password reset link clicked — hold the session but force the reset form.
      // Supabase v2 may fire PASSWORD_RECOVERY, SIGNED_IN, or INITIAL_SESSION
      // depending on when the listener registers relative to hash processing.
      // _recoveryPending (set from the URL hash at module load) catches all cases.
      if (session?.user && (event === 'PASSWORD_RECOVERY' || _recoveryPending)) {
        _recoveryPending = false;
        clearFallback();
        set({ user: session.user, session, loading: false, needsPasswordReset: true });
        return;
      }

      if (session?.user) {
        clearFallback();
        // Detect first-ever Google OAuth sign-in: last_sign_in_at ≈ created_at
        if (event === 'SIGNED_IN' && session.user.app_metadata?.provider === 'google') {
          const created     = new Date(session.user.created_at).getTime();
          const lastSignIn  = new Date(session.user.last_sign_in_at!).getTime();
          if (lastSignIn - created < 30_000) {
            sessionStorage.setItem('stt-new-signup', '1');
          }
        }
        set({ user: session.user, session, loading: false });
        // Fetch plan outside the callback (setTimeout exits the Supabase
        // internal callback chain before making another Supabase call).
        const userId = session.user.id;
        setTimeout(async () => {
          const plan = await fetchPlan(userId).catch(() => get().plan);
          // Only update if this is still the same user (guard against sign-out race)
          set(s => s.user?.id === userId ? { plan } : s);
        }, 0);

      } else if (event === 'SIGNED_OUT' && !get().loading) {
        // Post-init only (init-phase sign-outs are handled by getSession() below).
        // Defer the double-check outside the callback for the same reason as above.
        setTimeout(async () => {
          const { data: { session: live } } = await supabase.auth.getSession()
            .catch(() => ({ data: { session: null } }));
          if (live?.user) {
            const plan = await fetchPlan(live.user.id).catch(() => get().plan);
            set({ user: live.user, session: live, plan, loading: false });
          } else {
            set({ user: null, session: null, plan: 'free', loading: false });
          }
        }, 0);
      }
      // INITIAL_SESSION with null: do nothing — getSession() below is authoritative.
    });

    if (!_oauthCallback) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          clearFallback();
          // Check recovery BEFORE any other state update.
          // Supabase fires PASSWORD_RECOVERY asynchronously (deferred setTimeout),
          // so it may arrive after getSession() resolves. Reading _recoveryPending
          // here (set from the URL hash at module load) avoids the race entirely.
          if (_recoveryPending) {
            _recoveryPending = false;
            set({ user: session.user, session, loading: false, needsPasswordReset: true });
            return;
          }
          const plan = await fetchPlan(session.user.id).catch(() => get().plan);
          set({ user: session.user, session, plan, loading: false });
        } else if (_recoveryPending) {
          // getSession() returned null but we know a recovery token is in the URL.
          // Supabase processes hash tokens asynchronously — PASSWORD_RECOVERY will
          // fire via onAuthStateChange momentarily. Keep loading=true and let the
          // 8-second fallback guard against a stale/expired token.
        } else {
          clearFallback();
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
      options: {
        data: { full_name: name },
        // Confirmation link lands on the root; RootRedirect sends the
        // now-signed-in user to /dashboard.
        emailRedirectTo: SITE_ORIGIN,
      },
    });
    return error?.message ?? null;
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: SITE_ORIGIN },
    });
    return error?.message ?? null;
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_ORIGIN}/reset-password`,
    });
    return error?.message ?? null;
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    set({ needsPasswordReset: false });
    return null;
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
