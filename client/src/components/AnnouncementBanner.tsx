import React from 'react';
import { X, Megaphone } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';

export function AnnouncementBanner() {
  const announcements = useSessionStore(s => s.announcements);
  const dismiss       = useSessionStore(s => s.dismissAnnouncement);

  if (announcements.length === 0) return null;
  const latest = announcements[announcements.length - 1];

  return (
    <div className="absolute top-0 inset-x-0 z-50 animate-slide-down pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3
        bg-crimson-900/95 border-b border-crimson-800/60 px-5 py-3 shadow-xl">
        <Megaphone className="w-4 h-4 text-crimson-300 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-warm-200">{latest.text}</p>
          <p className="text-[11px] text-crimson-400/70 mt-0.5">— {latest.sentBy}</p>
        </div>
        <button
          onClick={() => dismiss(latest.id)}
          className="text-crimson-500 hover:text-crimson-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
