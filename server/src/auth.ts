import { createClient } from '@supabase/supabase-js';
import type { Plan } from '@program-timer/shared';

const supabaseUrl        = process.env.SUPABASE_URL        ?? '';
const supabaseSecretKey  = process.env.SUPABASE_SECRET_KEY ?? '';

const supabaseAdmin = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export interface VerifiedUser {
  userId: string;
  plan:   Plan;
}

/** Verify a Supabase access token and return the user's plan.
 *  Returns null if the token is invalid or Supabase is not configured. */
export async function verifyToken(token: string): Promise<VerifiedUser | null> {
  if (!supabaseAdmin) {
    console.warn('[auth] Supabase not configured — rejecting room:create');
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    plan:   (profile?.plan as Plan) ?? 'free',
  };
}

export async function deleteUser(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  return !error;
}
