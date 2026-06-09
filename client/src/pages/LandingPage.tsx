import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Check, ArrowRight, Users, Clock, Zap } from 'lucide-react';
import { MiniTimerDemo } from '../components/MiniTimerDemo';
import { AuthModal } from '../components/AuthModal';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/timeUtils';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthly: { price: '€0', period: '' },
    yearly:  { price: '€0', period: '', savings: '' },
    color: 'border-warm-700/50',
    badge: '',
    features: ['Upload & run timer', 'Save productions & events', 'Schedule editor', 'Unlimited schedule rows'],
    cta: 'Try for free',
    ctaCls: 'bg-warm-800 hover:bg-warm-700 text-warm-200 border border-warm-700',
  },
  {
    id: 'premium1',
    name: 'Pro',
    monthly: { price: '€4.99', period: '/mo' },
    yearly:  { price: '€24.99', period: '/yr', savings: 'Save 58%' },
    color: 'border-amber-700/50',
    badge: 'text-amber-300',
    features: ['Everything in Free', 'Connect Google Sheets', 'Room for 5 devices', 'Presenter screen'],
    cta: 'Get started',
    ctaCls: 'bg-amber-800/60 hover:bg-amber-700/60 text-amber-100 border border-amber-700/60',
  },
  {
    id: 'premium2',
    name: 'Studio',
    monthly: { price: '€6.99', period: '/mo' },
    yearly:  { price: '€35.99', period: '/yr', savings: 'Save 57%' },
    color: 'border-crimson-700/50',
    badge: 'text-crimson-300',
    features: ['Everything in Pro', 'Room for 15 devices', 'Custom schedule columns'],
    cta: 'Get started',
    ctaCls: 'bg-crimson-800/60 hover:bg-crimson-700/60 text-crimson-100 border border-crimson-700/60',
  },
];

export function LandingPage() {
  const navigate   = useNavigate();
  const user       = useAuthStore(s => s.user);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const openSignUp = () => { setAuthMode('signup'); setShowAuth(true); };
  const openSignIn = () => { setAuthMode('signin'); setShowAuth(true); };

  return (
    <div className="min-h-screen bg-warm-950 text-warm-100">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 h-14 border-b border-warm-800/40">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-crimson-400" />
          <span className="text-sm font-bold text-warm-100 tracking-tight">SheetToTimer</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={() => navigate('/dashboard')}
              className="text-sm px-4 py-1.5 rounded-lg bg-crimson-800/60 hover:bg-crimson-700/60
                border border-crimson-700/50 text-warm-100 transition-colors">
              Dashboard →
            </button>
          ) : (
            <>
              <button onClick={openSignIn}
                className="text-sm px-3 py-1.5 text-warm-500 hover:text-warm-300 transition-colors">
                Sign in
              </button>
              <button onClick={openSignUp}
                className="text-sm px-4 py-1.5 rounded-lg bg-crimson-800/60 hover:bg-crimson-700/60
                  border border-crimson-700/50 text-warm-100 transition-colors">
                Sign up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-8 py-20 flex flex-col lg:flex-row items-center gap-16">
        {/* Left copy */}
        <div className="flex-1 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-crimson-900/30 border border-crimson-800/40
            text-crimson-300 text-[11px] px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            <Zap className="w-3 h-3" /> Live show management
          </div>
          <h1 className="text-5xl font-bold leading-tight text-warm-100 mb-4">
            Run your show<br />
            <span className="text-crimson-400">from a spreadsheet.</span>
          </h1>
          <p className="text-warm-400 text-lg leading-relaxed mb-8">
            Upload your Excel run-of-show, share a room code with your crew,
            and keep everyone on the same countdown — live.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/app')}
              className="flex items-center gap-2 px-6 py-3 bg-crimson-700 hover:bg-crimson-600
                text-warm-100 font-semibold rounded-xl transition-colors text-sm">
              Try for free <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={openSignUp}
              className="flex items-center gap-2 px-6 py-3 bg-warm-800/60 hover:bg-warm-700/60
                text-warm-300 font-medium rounded-xl border border-warm-700/50 transition-colors text-sm">
              Sign up
            </button>
          </div>
          <div className="flex items-center gap-6 mt-8 text-warm-400 text-xs">
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-moss-400" /> Works with Excel & Google Sheets</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-moss-400" /> Setup in 60 seconds</span>
          </div>
        </div>

        {/* Right: live demo */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <p className="text-[10px] text-warm-500 uppercase tracking-widest mb-1">Try out the timer</p>
          <MiniTimerDemo />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-warm-800/30 bg-warm-900/30">
        <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Radio className="w-5 h-5 text-crimson-400" />, title: 'Real-time sync', body: 'Share a 6-character room code. Everyone sees the same countdown, instantly.' },
            { icon: <Users className="w-5 h-5 text-amber-400" />, title: 'Operator + viewers', body: 'One operator controls the clock. Viewers follow live on their own screens.' },
            { icon: <Clock className="w-5 h-5 text-moss-400" />, title: 'Overtime tracking', body: 'Items running long? The timer turns red and cascades the delay through the rest of your show.' },
          ].map(f => (
            <div key={f.title} className="space-y-2">
              {f.icon}
              <h3 className="text-sm font-semibold text-warm-200">{f.title}</h3>
              <p className="text-sm text-warm-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-8 py-20" id="pricing">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-warm-100 mb-2">Simple pricing</h2>
          <p className="text-warm-400">Start free. Upgrade when you need rooms and collaboration.</p>
          {/* Billing interval toggle */}
          <div className="inline-flex mt-6 rounded-lg border border-warm-700/50 overflow-hidden text-sm">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn('px-5 py-2 transition-colors',
                billingInterval === 'monthly' ? 'bg-warm-700 text-warm-100' : 'text-warm-500 hover:text-warm-300')}>
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={cn('px-5 py-2 flex items-center gap-2 transition-colors',
                billingInterval === 'yearly' ? 'bg-warm-700 text-warm-100' : 'text-warm-500 hover:text-warm-300')}>
              Yearly
              <span className="text-[11px] text-moss-400 font-medium">Save up to 58%</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {PLANS.map(plan => {
            const pricing = billingInterval === 'yearly' ? plan.yearly : plan.monthly;
            return (
            <div key={plan.id}
              className={cn('bg-warm-900/60 border rounded-xl p-6 flex flex-col', plan.color)}>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-bold uppercase tracking-wider', plan.badge || 'text-warm-500')}>
                    {plan.name}
                  </span>
                  {billingInterval === 'yearly' && plan.yearly.savings && (
                    <span className="text-[10px] text-moss-400 font-semibold bg-moss-900/30 border border-moss-700/40 px-2 py-0.5 rounded-full">
                      {plan.yearly.savings}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className="text-3xl font-bold text-warm-100">{pricing.price}</span>
                  <span className="text-warm-400 text-sm">{pricing.period}</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-warm-400">
                    <Check className="w-3.5 h-3.5 text-moss-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={plan.id === 'free' ? () => navigate('/app') : openSignUp}
                className={cn('w-full py-2 rounded-lg text-sm font-medium transition-colors', plan.ctaCls)}>
                {plan.cta}
              </button>
            </div>
          );
          })}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-warm-800/30 px-8 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px] text-warm-500">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-crimson-600" />
            <span>© {new Date().getFullYear()} Notwey</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-warm-300 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-warm-300 transition-colors">Terms of Service</a>
            <a href="mailto:support@notwey.com" className="hover:text-warm-300 transition-colors">support@notwey.com</a>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} defaultMode={authMode} />}
    </div>
  );
}
