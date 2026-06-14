import Stripe from 'stripe';
import type { Plan } from '@program-timer/shared';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-05-27.dahlia',
});

export const PRICE_IDS: Record<Exclude<Plan, 'free'>, { monthly: string; yearly: string }> = {
  premium1: {
    monthly: process.env.STRIPE_PRO_PRICE_ID     ?? '',
    yearly:  process.env.STRIPE_PRO_ANN_PRICE_ID  ?? '',
  },
  premium2: {
    monthly: process.env.STRIPE_STUDIO_PRICE_ID     ?? '',
    yearly:  process.env.STRIPE_STUDIO_ANN_PRICE_ID ?? '',
  },
};

export const LIFETIME_PRICE_ID: string = process.env.STRIPE_LIFETIME_PRICE_ID ?? '';
export const LIFETIME_PLAN: Exclude<Plan, 'free'> = 'premium2';

// Built at runtime so env vars are read after dotenv loads
export function getPriceToPlan(): Record<string, Exclude<Plan, 'free'>> {
  const map: Record<string, Exclude<Plan, 'free'>> = {
    [process.env.STRIPE_PRO_PRICE_ID        ?? '']: 'premium1',
    [process.env.STRIPE_PRO_ANN_PRICE_ID    ?? '']: 'premium1',
    [process.env.STRIPE_STUDIO_PRICE_ID     ?? '']: 'premium2',
    [process.env.STRIPE_STUDIO_ANN_PRICE_ID ?? '']: 'premium2',
  };
  if (LIFETIME_PRICE_ID) map[LIFETIME_PRICE_ID] = LIFETIME_PLAN;
  return map;
}
