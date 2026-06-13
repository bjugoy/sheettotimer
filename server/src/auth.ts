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
  try {
    // Delete in FK dependency order so no orphaned rows remain.
    // The service role key bypasses RLS — all rows are removed regardless
    // of the user's own access policies.
    const { error: eventsErr } = await supabaseAdmin
      .from('events').delete().eq('user_id', userId);
    if (eventsErr) throw eventsErr;

    const { error: prodsErr } = await supabaseAdmin
      .from('productions').delete().eq('user_id', userId);
    if (prodsErr) throw prodsErr;

    const { error: profileErr } = await supabaseAdmin
      .from('profiles').delete().eq('id', userId);
    if (profileErr) throw profileErr;

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw authErr;

    return true;
  } catch (err) {
    console.error('[auth] deleteUser cascade failed:', err);
    return false;
  }
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  return (data?.stripe_customer_id as string | null) ?? null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);
}

export async function updatePlanByStripeCustomerId(customerId: string, plan: Plan): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('profiles')
    .update({ plan })
    .eq('stripe_customer_id', customerId);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
  return user?.email ?? null;
}
