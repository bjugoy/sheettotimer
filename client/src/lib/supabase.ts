import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUB_KEY as string | undefined;

if (!url || !key) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUB_KEY not set — auth disabled');
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'placeholder');

// Canonical origin for auth redirects (email links, OAuth). Must be the
// Vercel PRIMARY domain — www. The apex 307-redirects to www, and that extra
// hop can drop the #access_token fragment Supabase puts in email links.
// Must also be whitelisted in Supabase → Auth → URL Configuration.
export const SITE_ORIGIN = window.location.hostname === 'localhost'
  ? window.location.origin
  : 'https://www.sheettotimer.com';
