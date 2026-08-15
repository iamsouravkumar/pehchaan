'use client';

import { useEffect, useState } from 'react';
import { NO_TRAFFIC, watchTraffic, type Traffic } from '@/lib/privacy';

/**
 * Persistent, top right (DESIGN.md §7). Green dot and a count while it is zero;
 * if anything ever goes off-device it turns to `--alert` and names the host.
 * The failure case is the one that must not be hidden.
 */
export default function PrivacyBadge() {
  const [traffic, setTraffic] = useState<Traffic>(NO_TRAFFIC);

  useEffect(() => watchTraffic(setTraffic), []);

  const clean = traffic.offDevice === 0;

  return (
    <span
      className="flex items-center gap-1.5 font-mono text-xs"
      title={
        clean
          ? 'Nothing has been sent anywhere. The app itself is served from this address; your document is never uploaded.'
          : `Unexpected traffic to ${traffic.hosts.join(', ')}`
      }
    >
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${clean ? 'bg-safe' : 'bg-alert'}`}
      />
      {/* The full phrase wraps to two lines in a 390px header, so the qualifier
          is dropped on small screens. The dot and the number carry the meaning;
          the title attribute and the closing line on the save step carry the
          rest. */}
      <span className={`whitespace-nowrap ${clean ? 'text-ink-soft' : 'text-alert'}`}>
        {traffic.offDevice} sent<span className="hidden sm:inline"> off this device</span>
      </span>
    </span>
  );
}
