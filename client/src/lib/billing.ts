import { apiUrl } from './api';
import type { Plan } from '@program-timer/shared';

async function postJSON(path: string, token: string, body?: object) {
  const res = await fetch(apiUrl(path), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: Record<string, string>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}) — check that VITE_SERVER_URL points to your Heroku app`);
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function startCheckout(plan: Exclude<Plan, 'free'>, token: string, interval: 'monthly' | 'yearly' | 'lifetime' = 'monthly'): Promise<void> {
  const data = await postJSON('/api/billing/checkout', token, { plan, interval, returnUrl: window.location.href });
  window.location.href = data.url;
}

export async function syncPlanFromStripe(token: string): Promise<string | null> {
  try {
    const data = await postJSON('/api/billing/sync', token);
    return data.plan ?? null;
  } catch {
    return null;
  }
}

export async function openBillingPortal(token: string): Promise<void> {
  const data = await postJSON('/api/billing/portal', token, { returnUrl: window.location.href });
  window.location.href = data.url;
}
