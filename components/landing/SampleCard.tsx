'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The page's thesis, and its one memorable moment (LANDING.md §4).
 *
 * A sample card renders complete and readable, then redaction bars sweep across
 * it one field at a time, and a purpose stamp presses down at an angle. It holds,
 * reverses, and loops. The whole product is understood before a word of feature
 * copy is read.
 *
 * Real DOM, not a video or a GIF: crisp at any size, weighs nothing, and it
 * still renders — complete and unredacted, which is the honest resting state —
 * if JavaScript never runs.
 *
 * Every value here is fabricated. The number fails its checksum on purpose.
 */

/** Fields in the order they get covered. Delays are staggered 180ms apart. */
const FIELDS = [
  { label: 'Name', value: 'Aarav Testwala' },
  { label: 'DOB', value: '01/01/1990' },
  { label: 'Address', value: 'H.No 12, Nehru Road, Pune' },
];

export default function SampleCard() {
  const root = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);

  // Pause when the card is off screen rather than burning frames while someone
  // reads the footer (LANDING.md §5).
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={root}
      aria-hidden
      className="border-rule bg-surface w-full max-w-md rounded-xl border p-5 shadow-[0_1px_2px_rgba(23,24,27,0.04)]"
      style={{ animationPlayState: running ? 'running' : 'paused' }}
    >
      <div className="text-ink-soft mb-4 flex items-center justify-between font-mono text-[10px] tracking-[0.12em] uppercase">
        <span>Sample card</span>
        <span>Fabricated data</span>
      </div>

      <div className="relative flex flex-col gap-3">
        {FIELDS.map((field, i) => (
          <div key={field.label} className="flex items-baseline gap-3">
            <span className="text-ink-soft w-20 shrink-0 font-mono text-[11px] tracking-wide uppercase">
              {field.label}
            </span>
            <span className="relative text-[15px]">
              {field.value}
              <Bar index={i} running={running} />
            </span>
          </div>
        ))}

        <div className="flex items-baseline gap-3">
          <span className="text-ink-soft w-20 shrink-0 font-mono text-[11px] tracking-wide uppercase">
            Number
          </span>
          <span className="font-mono text-[15px] tracking-wider">
            {/* The last four stay readable — the recipient still needs to know
                which document this is. */}
            <span className="relative">
              1234 5678
              <Bar index={FIELDS.length} running={running} />
            </span>{' '}
            9012
          </span>
        </div>

      </div>

      {/* Its own row rather than an overlay: floated over the fields it lands on
          top of the number, and a stamp that obscures the thing it certifies is
          worse than no stamp. */}
      <div className="mt-5 flex h-6 items-center justify-center">
        <span
          className="stamp-press text-stamp/70 pointer-events-none font-mono text-[13px] whitespace-nowrap"
          style={{ animationPlayState: running ? 'running' : 'paused' }}
        >
          For HDFC KYC only · 15 Aug 2026
        </span>
      </div>
    </div>
  );
}

/**
 * One redaction bar. Absolutely positioned over its field so the text underneath
 * is what sets the width — the bar always fits the thing it covers.
 */
function Bar({ index, running }: { index: number; running: boolean }) {
  return (
    <span
      className="redact-sweep bg-redact absolute inset-x-[-3px] inset-y-[-2px] origin-left"
      style={{
        animationDelay: `${index * 0.18}s`,
        animationPlayState: running ? 'running' : 'paused',
      }}
    />
  );
}
