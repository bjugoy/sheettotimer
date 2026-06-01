import Stripe from 'stripe';
import type { Plan } from '@program-timer/shared';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-05-27.dahlia',
});

export const PRICE_IDS: Record<Exclude<Plan, 'free'>, string> = {
  premium1: process.env.STRIPE_PRO_PRICE_ID    ?? '',
  premium2: process.env.STRIPE_STUDIO_PRICE_ID ?? '',
};

// Built at runtime so env vars are read after dotenv loads
export function getPriceToPlan(): Record<string, Exclude<Plan, 'free'>> {
  return {
    [process.env.STRIPE_PRO_PRICE_ID    ?? '']: 'premium1',
    [process.env.STRIPE_STUDIO_PRICE_ID ?? '']: 'premium2',
  };
}
