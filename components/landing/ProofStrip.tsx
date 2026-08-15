'use client';

import { useEffect, useState } from 'react';
import { NO_TRAFFIC, watchTraffic, type Traffic } from '@/lib/privacy';

/**
 * The most persuasive element on the page, because it is checkable in five
 * seconds (LANDING.md §4). Counting real resource entries makes the landing page
 * an instance of the claim rather than an argument for it.
 *
 * If it is ever above zero it shows the real number and names the host. A
 * privacy tool that lies about its own counter does not get a second chance.
 */
export default function ProofStrip() {
  const [traffic, setTraffic] = useState<Traffic>(NO_TRAFFIC);
  useEffect(() => watchTraffic(setTraffic), []);

  const clean = traffic.offDevice === 0;

  return (
    <section className="border-rule border-y">
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 px-5 py-7">
        <p className="flex items-center gap-2.5 text-[17px]">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${clean ? 'bg-safe' : 'bg-alert'}`}
          />
          <span className={clean ? '' : 'text-alert'}>
            Requests made while you&apos;ve been reading:{' '}
            {/* No animation when it increments. A privacy counter should not
                celebrate. */}
            <strong className="font-mono">{traffic.offDevice}</strong>
          </span>
        </p>
        <p className="text-ink-soft pl-[18px] text-[15px]">
          {clean
            ? "Open your browser's Network tab and watch. This page doesn't talk to anyone either."
            : `Something reached ${traffic.hosts.join(', ')}. That shouldn't happen — please open an issue.`}
        </p>
      </div>
    </section>
  );
}
