import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Radio, Loader2 } from 'lucide-react';
import type { Package } from '@revenuecat/purchases-js';
import { useAuthStore } from '../store/authStore';
import {
  getRC, isRCConfigured, entitlementsToPlan,
  PurchasesError, ErrorCode, PLAN_ENTITLEMENT,
} from '../lib/revenuecat';
import { getPlanFeatures, PLAN_BADGE_COLOR } from '../lib/plans';
import type { Plan } from '../lib/plans';
import { cn } from '../utils/timeUtils';

// ── Static fallback when RC is not yet configured ─────────────────────────────

const STATIC_PLANS = [
  {
    id: 'free'      as Plan,
    name: 'Free',    price: '$0',    period: '',
    description: 'For personal use and small events.',
    color: 'border-warm-700/50',   labelCls: 'text-warm-500',
    ctaCls: 'bg-warm-800 hover:bg-warm-700 text-warm-200 border border-warm-700',
    features: ['Upload & run timer', 'Unlimited rows', 'Local only — no rooms'],
  },
  {
    id: 'premium1'  as Plan,
    name: 'Pro',     price: '$19',   period: '/mo',
    description: 'For small production teams.',
    color: 'border-amber-700/50',  labelCls: 'text-amber-300',
    ctaCls: 'bg-amber-800/60 hover:bg-amber-700/60 text-amber-100 border border-amber-700/60',
    features: ['Everything in Free', 'Schedule editor', 'Room for 5', 'Presenter screen', 'Save events & days'],
    highlight: true,
  },
  {
    id: 'premium2'  as Plan,
    name: 'Studio',  price: '$49',   period: '/mo',
    description: 'For mid-size crews and venues.',
    color: 'border-crimson-700/50', labelCls: 'text-crimson-300',
    ctaCls: 'bg-crimson-800/60 hover:bg-crimson-700/60 text-crimson-100 border border-crimson-700/60',
    features: ['Everything in Pro', 'Room for 15'],
  },
  {
    id: 'premium3'  as Plan,
    name: 'Enterprise', price: '$99', period: '/mo',
    description: 'For large events and broadcast.',
    color: 'border-moss-700/50',   labelCls: 'text-moss-300',
    ctaCls: 'bg-moss-800/60 hover:bg-moss-700/60 text-moss-100 border border-moss-700/60',
    features: ['Everything in Studio', 'Room for 50'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(pkg: Package): string {
  const p = pkg.rcBillingProduct?.currentPrice;
  if (!p) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: p.currency ?? 'USD', minimumFractionDigits: 0,
  }).format((p.amountMicros ?? 0) / 1_000_000);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaywallPage() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const user              = useAuthStore(s => s.user);
  const currentPlan       = useAuthStore(s => s.plan);
  const setPlan           = useAuthStore(s => s.setPlan);
  const refreshPlan       = useAuthStore(s => s.refreshPlan);

  // Packages fetched from RC
  const [packages, setPackages]   = useState<Package[] | null>(null);
  const [rcLoading, setRcLoading] = useState(isRCConfigured());

  // Purchase state
  const [purchasing, setPurchasing] = useState<Plan | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [successPlan, setSuccessPlan]     = useState<Plan | null>(null);

  // Check if returning from Stripe checkout redirect
  const returnedSuccess = params.get('rc_result') === 'success';

  // ── Load RC offerings ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRCConfigured()) return;
    const rc = getRC();
    if (!rc) return;

    rc.getOfferings()
      .then(offerings => setPackages(offerings.current?.availablePackages ?? []))
      .catch(() => setPackages([]))
      .finally(() => setRcLoading(false));
  }, []);

  // ── Handle redirect return from Stripe ────────────────────────────────────
  useEffect(() => {
    if (!returnedSuccess) return;
    // Clear the param, refresh plan from both RC and Supabase
    window.history.replaceState({}, '', '/paywall');
    const rc = getRC();
    if (!rc) { refreshPlan(); return; }

    rc.getCustomerInfo().then(info => {
      const active = Object.keys(info.entitlements.active);
      const plan   = entitlementsToPlan(active);
      setPlan(plan);
      if (plan !== 'free') setSuccessPlan(plan);
    }).catch(() => refreshPlan());
  }, [returnedSuccess]);

  // ── Purchase handler ───────────────────────────────────────────────────────
  const handlePurchase = async (planId: Plan, pkg?: Package) => {
    if (planId === 'free') { navigate('/dashboard'); return; }
    setPurchaseError(null);

    // No RC or no matching package → placeholder
    if (!isRCConfigured() || !pkg) {
      alert('Payments are not yet configured. Ask the administrator to set up RevenueCat.');
      return;
    }

    const rc = getRC();
    if (!rc) return;

    setPurchasing(planId);
    try {
      const { customerInfo } = await rc.purchase({ rcPackage: pkg });
      const active = Object.keys(customerInfo.entitlements.active);
      const newPlan = entitlementsToPlan(active);
      setPlan(newPlan);
      setSuccessPlan(newPlan);
    } catch (e) {
      if (e instanceof PurchasesError && e.errorCode === ErrorCode.UserCancelledError) {
        // User cancelled — no error to show
      } else {
        setPurchaseError(e instanceof Error ? e.message : 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  };

  // ── Find matching RC package for a plan ────────────────────────────────────
  const packageForPlan = (planId: Exclude<Plan, 'free'>): Package | undefined => {
    if (!packages) return undefined;
    const entitlement = PLAN_ENTITLEMENT[planId];
    // Match by package identifier containing the entitlement name (e.g. "pro_monthly" contains "pro")
    return packages.find(pkg => pkg.identifier.toLowerCase().includes(entitlement));
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successPlan && successPlan !== 'free') {
    const f = getPlanFeatures(successPlan);
    return (
      <div className="min-h-screen bg-warm-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 w-14 h-14 rounded-full bg-moss-900/40 border border-moss-700/40
          flex items-center justify-center">
          <Check className="w-7 h-7 text-moss-400" />
        </div>
        <h1 className="text-2xl font-bold text-warm-100 mb-2">
          You're on {f.label}!
        </h1>
        <p className="text-warm-500 text-sm mb-8">
          Your plan is active. Rooms, editor, and all premium features are unlocked.
        </p>
        <button onClick={() => navigate('/dashboard')}
          className="px-8 py-3 bg-crimson-800/60 hover:bg-crimson-700/60 border border-crimson-700/50
            text-warm-100 font-medium rounded-xl transition-colors">
          Go to Dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-950 flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-8 h-14 border-b border-warm-800/40">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-crimson-400" />
          <span className="text-sm font-bold text-warm-100">SheetToTimer</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] px-2 py-0.5 rounded border', PLAN_BADGE_COLOR[currentPlan])}>
              {getPlanFeatures(currentPlan).label}
            </span>
            <span className="text-xs text-warm-600">{user.email}</span>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-warm-100 mb-2">Choose your plan</h1>
          <p className="text-warm-500 text-sm">
            Start free, upgrade any time. All paid plans include a 7-day free trial.
          </p>
          {!isRCConfigured() && (
            <p className="mt-3 text-xs text-amber-500/80 bg-amber-900/20 border border-amber-800/30
              px-4 py-2 rounded-lg inline-block">
              Payments not yet configured — see setup guide below
            </p>
          )}
          {purchaseError && (
            <p className="mt-3 text-xs text-crimson-300 bg-crimson-900/20 border border-crimson-800/30
              px-4 py-2 rounded-lg inline-block">
              {purchaseError}
            </p>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
          {STATIC_PLANS.map(plan => {
            const pkg     = plan.id !== 'free' ? packageForPlan(plan.id) : undefined;
            const price   = pkg ? formatPrice(pkg) : plan.price;
            const isBusy  = purchasing === plan.id;
            const isCurrent = currentPlan === plan.id;

            return (
              <div key={plan.id}
                className={cn(
                  'bg-warm-900/70 border rounded-xl p-6 flex flex-col',
                  plan.color,
                  plan.highlight && 'ring-1 ring-amber-600/40',
                  isCurrent && 'ring-2 ring-crimson-600/50'
                )}>

                {plan.highlight && !isCurrent && (
                  <div className="text-[10px] text-amber-300 bg-amber-900/40 border border-amber-800/40
                    px-2 py-0.5 rounded-full w-fit mb-3 uppercase tracking-widest">
                    Most popular
                  </div>
                )}
                {isCurrent && (
                  <div className="text-[10px] text-crimson-300 bg-crimson-900/40 border border-crimson-800/40
                    px-2 py-0.5 rounded-full w-fit mb-3 uppercase tracking-widest">
                    Current plan
                  </div>
                )}

                <span className={cn('text-xs font-bold uppercase tracking-wider', plan.labelCls)}>
                  {plan.name}
                </span>
                <div className="flex items-baseline gap-0.5 mt-1 mb-1">
                  {rcLoading && plan.id !== 'free' ? (
                    <Loader2 className="w-4 h-4 text-warm-600 animate-spin" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-warm-100">{price}</span>
                      <span className="text-warm-600 text-sm">{plan.period}</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-warm-600 mb-4">{plan.description}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-warm-400">
                      <Check className="w-3.5 h-3.5 text-moss-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(plan.id, pkg)}
                  disabled={isBusy || isCurrent}
                  className={cn('w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
                    plan.ctaCls,
                    (isBusy || isCurrent) && 'opacity-50 cursor-not-allowed')}>
                  {isBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </span>
                  ) : isCurrent ? 'Current plan' : plan.id === 'free' ? 'Continue free' : 'Start free trial'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-warm-700">
          Cancel any time. You'll keep access until the end of your billing period.
        </p>
      </main>
    </div>
  );
}
