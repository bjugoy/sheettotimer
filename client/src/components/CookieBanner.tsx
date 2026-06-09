import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'stt-cookies-acknowledged';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9998] flex items-center justify-between gap-4
      px-5 py-3 bg-warm-900 border-t border-warm-800/60 shadow-lg">
      <p className="text-xs text-warm-400 leading-relaxed">
        We use cookies strictly necessary to operate this service — authentication (Supabase)
        and payment processing (Stripe). No analytics or tracking cookies are used.{' '}
        <a href="/privacy" className="text-amber-400 hover:underline">Privacy Policy</a>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 text-xs px-3 py-1.5 bg-warm-800 hover:bg-warm-700
          border border-warm-700/60 text-warm-200 rounded-lg transition-colors">
        Got it
      </button>
    </div>
  );
}
