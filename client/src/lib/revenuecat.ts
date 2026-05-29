import { Purchases, PurchasesError, ErrorCode } from '@revenuecat/purchases-js';
import type { Plan } from './plans';

const RC_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;

export function isRCConfigured() {
  return !!RC_API_KEY;
}

/** Call once after the user is identified (auth state change). */
export function configureRC(userId: string): void {
  if (!RC_API_KEY) return;
  try {
    Purchases.configure(RC_API_KEY, userId);
  } catch {
    // Already configured — change the user ID
    Purchases.getSharedInstance().changeUser(userId);
  }
}

export function getRC(): InstanceType<typeof Purchases> | null {
  if (!RC_API_KEY) return null;
  try { return Purchases.getSharedInstance(); }
  catch { return null; }
}

// ── Entitlement identifiers (must match your RC dashboard) ────────────────────
// Create these in RC: Dashboard → Entitlements → New
//   Identifier: pro        → attach Pro Monthly product
//   Identifier: studio     → attach Studio Monthly product
//   Identifier: enterprise → attach Enterprise Monthly product

export const PLAN_ENTITLEMENT: Record<Exclude<Plan, 'free'>, string> = {
  premium1: 'pro',
  premium2: 'studio',
  premium3: 'enterprise',
};

export const ENTITLEMENT_PLAN: Record<string, Plan> = {
  pro:        'premium1',
  studio:     'premium2',
  enterprise: 'premium3',
};

/** Returns the highest active plan from a CustomerInfo entitlements map. */
export function entitlementsToPlan(activeEntitlementKeys: string[]): Plan {
  if (activeEntitlementKeys.includes('enterprise')) return 'premium3';
  if (activeEntitlementKeys.includes('studio'))     return 'premium2';
  if (activeEntitlementKeys.includes('pro'))        return 'premium1';
  return 'free';
}

export { PurchasesError, ErrorCode };
