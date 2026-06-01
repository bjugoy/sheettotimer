import type { Plan } from './plans';

const RC_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;

export function isRCConfigured() {
  return !!RC_API_KEY;
}

// Lazy-load the RC SDK so it doesn't run at app startup.
// This avoids a conflict with browser extensions that also load TensorFlow/WebGL.
async function loadRC() {
  const mod = await import('@revenuecat/purchases-js');
  return mod;
}

/** Call once after the user is identified (auth state change). */
export async function configureRC(userId: string): Promise<void> {
  if (!RC_API_KEY) return;
  try {
    const { Purchases } = await loadRC();
    try {
      Purchases.configure(RC_API_KEY, userId);
    } catch {
      Purchases.getSharedInstance().changeUser(userId);
    }
  } catch { /* SDK failed to load — non-fatal */ }
}

/** Returns the RC Purchases instance, or null if unavailable. */
export async function getRC() {
  if (!RC_API_KEY) return null;
  try {
    const { Purchases } = await loadRC();
    return Purchases.getSharedInstance();
  } catch { return null; }
}

/** Purchase errors — re-exported lazily. */
export async function getPurchasesError() {
  const { PurchasesError, ErrorCode } = await loadRC();
  return { PurchasesError, ErrorCode };
}

// ── Entitlement identifiers (must match your RC dashboard) ────────────────────

export const PLAN_ENTITLEMENT: Record<Exclude<Plan, 'free'>, string> = {
  premium1: 'pro',
  premium2: 'studio',
};

export const ENTITLEMENT_PLAN: Record<string, Plan> = {
  pro:    'premium1',
  studio: 'premium2',
};

export function entitlementsToPlan(activeEntitlementKeys: string[]): Plan {
  if (activeEntitlementKeys.includes('studio')) return 'premium2';
  if (activeEntitlementKeys.includes('pro'))    return 'premium1';
  return 'free';
}
