import { apiUrl } from './api';
import type { Plan } from '@program-timer/shared';

async function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function startCheckout(plan: Exclude<Plan, 'free'>, token: string): Promise<void> {
  const res  = await fetch(apiUrl('/api/billing/checkout'), {
    method:  'POST',
    headers: await authHeaders(token),
    body:    JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout');
  window.location.href = data.url;
}

export async function openBillingPortal(token: string): Promise<void> {
  const res  = await fetch(apiUrl('/api/billing/portal'), {
    method:  'POST',
    headers: await authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to open portal');
  window.location.href = data.url;
}
