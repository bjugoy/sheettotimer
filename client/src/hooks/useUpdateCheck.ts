import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useUpdateCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baseRef = useRef<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { buildTime: number };
        if (baseRef.current === null) {
          baseRef.current = data.buildTime; // first load — store baseline
        } else if (data.buildTime !== baseRef.current) {
          setUpdateAvailable(true);         // new deploy detected
        }
      } catch {
        // network error — ignore, try again next poll
      }
    };

    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return updateAvailable;
}
