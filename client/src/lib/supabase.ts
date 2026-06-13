import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUB_KEY as string | undefined;

if (!url || !key) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUB_KEY not set — auth disabled');
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'placeholder', {
  auth: { flowType: 'pkce' },
});
