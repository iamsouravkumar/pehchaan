'use client';

import { useEffect } from 'react';

/**
 * Registers the offline cache. Production only; in development the chunk URLs
 * change on every edit and a cached one serves stale code that looks like a
 * mystery bug.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    // Failure here is not worth surfacing: the app works online regardless, and
    // the only thing lost is offline capability.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
