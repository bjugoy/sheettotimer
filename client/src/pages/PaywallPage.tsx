import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Radio, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getPlanFeatures, PLAN_BADGE_COLOR } from '../lib/plans';
import type { Plan } from '../lib/plans';
import { cn } from '../utils/timeUtils';
import { startCheckout, syncPlanFromStripe, openBillingPortal } from '../lib/billing';
import { AuthModal } from '../components/AuthModal';

const STATIC_PLANS: {
  id: Plan;
  name: string;
  prices: { monthly: string; yearly: string };
  periods: { monthly: string; yearly: string };
  savings: { monthly: string; yearly: string };
  description: string;
  color: string;
  labelCls: string;
  ctaCls: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: 'free',
    name: 'Free',
    prices:  { monthly: '€0',     yearly: '€0'     },
    periods: { monthly: '',       yearly: ''        },
    savings: { monthly: '',       yearly: ''        },
    description: 'For personal use and small events.',
    color:    'border-warm-700/50',
    labelCls: 'text-warm-500',
    ctaCls:   'bg-warm-800 hover:bg-warm-700 text-warm-200 border border-warm-700',
    features: ['Upload & run timer', 'Unlimited rows', 'Local only — no rooms, no saving'],
  },
  {
    id: 'premium1',
    name: 'Pro',
    prices:  { monthly: '€4.99',  yearly: '€24.99' },
    periods: { monthly: '/mo',    yearly: '/yr'     },
    savings: { monthly: '',       yearly: 'Save 58%' },
    description: 'For small production teams.',
    color:    'border-amber-700/50',
    labelCls: 'text-amber-300',
    ctaCls:   'bg-amber-800/60 hover:bg-amber-700/60 text-amber-100 border border-amber-700/60',
    features: ['Everything in Free', 'Save productions & events', 'Google Sheets sync', 'Room for 5 devices', 'Presenter screen'],
    highlight: true,
  },
  {
    id: 'premium2',
    name: 'Studio',
    prices:  { monthly: '€6.99',  yearly: '€35.99' },
    periods: { monthly: '/mo',    yearly: '/yr'     },
    savings: { monthly: '',       yearly: 'Save 57%' },
    description: 'For mid-size crews and venues.',
    color:    'border-crimson-700/50',
    labelCls: 'text-crimson-300',
    ctaCls:   'bg-crimson-800/60 hover:bg-crimson-700/60 text-crimson-100 border border-crimson-700/60',
    features: ['Everything in Pro', 'Room for 15 devices', 'Custom schedule columns'],
  },
];

export function PaywallPage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const user         = useAuthStore(s => s.user);
  const currentPlan  = useAuthStore(s => s.plan);
  const setPlan      = useAuthStore(s => s.setPlan);
  const refreshPlan  = useAuthStore(s => s.refreshPlan);
  const getToken     = useAuthStore(s => s.getToken);

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [purchasing, setPurchasing]           = useState<Plan | null>(null);
  const [purchaseError, setPurchaseError]     = useState<string | null>(null);
  const [successPlan, setSuccessPlan]         = useState<Plan | null>(null);
  const [showAuth, setShowAuth]               = useState(false);
  const [pendingPlan, setPendingPlan]         = useState<Plan | null>(null);
  const [syncing, setSyncing]                 = useState(false);

  const returnedSuccess =
    params.get('rc_result') === 'success' || params.get('billing') === 'success';

  // Sync plan from Stripe on mount so the current plan badge is accurate
  useEffect(() => {
    const token = getToken();
    if (!token) { refreshPlan(); return; }
    setSyncing(true);
    syncPlanFromStripe(token)
      .then(plan => { if (plan) setPlan(plan as Plan); else refreshPlan(); })
      .finally(() => setSyncing(false));
  }, []);

  // Handle redirect back from Stripe checkout
  useEffect(() => {
    if (!returnedSuccess) return;
    window.history.replaceState({}, '', '/paywall');
    const token = getToken();
    if (!token) { refreshPlan(); return; }
    syncPlanFromStripe(token).then(plan => {
      if (plan && plan !== 'free') {
        setPlan(plan as Plan);
        setSuccessPlan(plan as Plan);
      } else {
        refreshPlan();
      }
    });
  }, [returnedSuccess]);

  // After user signs in, auto-proceed to the checkout they initiated
  useEffect(() => {
    if (!user || !pendingPlan) return;
    const plan = pendingPlan;
    setPendingPlan(null);
    handleCheckout(plan);
  }, [user]);

  const handleCheckout = async (planId: Plan) => {
    if (planId === 'free') { navigate('/dashboard'); return; }

    const token = getToken();
    if (!token) {
      setPendingPlan(planId);
      setShowAuth(true);
      return;
    }

    setPurchasing(planId);
    setPurchaseError(null);
    try {
      await startCheckout(planId as Exclude<Plan, 'free'>, token, billingInterval);
      // startCheckout redirects — code below only runs on error
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setPurchasing(null);
    }
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
        <h1 className="text-2xl font-bold text-warm-100 mb-2">You're on {f.label}!</h1>
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/landing')}
            className="flex items-center gap-1.5 text-warm-600 hover:text-warm-300 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            {user ? 'Dashboard' : 'Back'}
          </button>
          <span className="text-warm-800">·</span>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-crimson-400" />
            <span className="text-sm font-bold text-warm-100">SheetToTimer</span>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {syncing
              ? <Loader2 className="w-3.5 h-3.5 text-warm-600 animate-spin" />
              : <span className={cn('text-[10px] px-2 py-0.5 rounded border', PLAN_BADGE_COLOR[currentPlan])}>
                  {getPlanFeatures(currentPlan).label}
                </span>
            }
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

          {purchaseError && (
            <p className="mt-3 text-xs text-crimson-300 bg-crimson-900/20 border border-crimson-800/30
              px-4 py-2 rounded-lg inline-block">
              {purchaseError}
            </p>
          )}

          {/* Billing interval toggle */}
          <div className="inline-flex mt-8 rounded-xl border-2 border-warm-700 bg-warm-900 p-1 gap-1">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn(
                'px-6 py-2.5 rounded-lg text-sm font-semibold transition-all',
                billingInterval === 'monthly'
                  ? 'bg-warm-700 text-warm-100 shadow'
                  : 'text-warm-400 hover:text-warm-200',
              )}>
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={cn(
                'px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2.5 transition-all',
                billingInterval === 'yearly'
                  ? 'bg-warm-700 text-warm-100 shadow'
                  : 'text-warm-400 hover:text-warm-200',
              )}>
              Yearly
              <span className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                billingInterval === 'yearly'
                  ? 'bg-moss-800/60 border-moss-600/60 text-moss-300'
                  : 'bg-moss-900/40 border-moss-700/40 text-moss-400',
              )}>Save up to 58%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          {STATIC_PLANS.map(plan => {
            const price    = plan.prices[billingInterval];
            const period   = plan.periods[billingInterval];
            const savings  = plan.savings[billingInterval];
            const isBusy   = purchasing === plan.id;
            const isCurrent = !syncing && currentPlan === plan.id;

            return (
              <div key={plan.id}
                className={cn(
                  'bg-warm-900/70 border rounded-xl p-6 flex flex-col',
                  plan.color,
                  plan.highlight && !isCurrent && 'ring-1 ring-amber-600/40',
                  isCurrent && 'ring-2 ring-moss-600/50',
                )}>

                {/* Badge row */}
                {isCurrent ? (
                  <div className="text-[10px] text-moss-300 bg-moss-900/40 border border-moss-800/40
                    px-2 py-0.5 rounded-full w-fit mb-3 uppercase tracking-widest">
                    Current plan
                  </div>
                ) : plan.highlight ? (
                  <div className="text-[10px] text-amber-300 bg-amber-900/40 border border-amber-800/40
                    px-2 py-0.5 rounded-full w-fit mb-3 uppercase tracking-widest">
                    Most popular
                  </div>
                ) : (
                  <div className="mb-3 h-[18px]" /> // spacer to align cards
                )}

                <span className={cn('text-xs font-bold uppercase tracking-wider', plan.labelCls)}>
                  {plan.name}
                </span>

                <div className="flex items-baseline gap-0.5 mt-1 mb-0.5">
                  <span className="text-3xl font-bold text-warm-100">{price}</span>
                  <span className="text-warm-600 text-sm">{period}</span>
                  {savings && (
                    <span className="ml-2 text-[10px] text-moss-400 font-semibold
                      bg-moss-900/30 border border-moss-700/40 px-1.5 py-0.5 rounded-full">
                      {savings}
                    </span>
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
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isBusy || (isCurrent && plan.id !== 'free')}
                  className={cn(
                    'w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
                    plan.ctaCls,
                    (isBusy || (isCurrent && plan.id !== 'free')) && 'opacity-50 cursor-not-allowed',
                  )}>
                  {isBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
                    </span>
                  ) : isCurrent && plan.id !== 'free' ? 'Current plan'
                    : plan.id === 'free' ? 'Continue free'
                    : 'Get started'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-warm-700">
            Cancel any time · Access continues until end of billing period
          </p>
          {user && currentPlan !== 'free' && (
            <button
              onClick={() => {
                const token = getToken();
                if (token) openBillingPortal(token).catch(() =>
                  alert('Could not open billing portal. Please contact support@notwey.com'));
              }}
              className="text-[11px] text-warm-600 hover:text-warm-400 underline underline-offset-2 transition-colors">
              Manage or cancel subscription
            </button>
          )}
        </div>
      </main>

      {showAuth && (
        <AuthModal
          onClose={() => { setShowAuth(false); setPendingPlan(null); }}
          defaultMode="signup"
        />
      )}
    </div>
  );
}
