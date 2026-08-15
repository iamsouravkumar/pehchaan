'use client';

import type { Step } from '@/lib/steps';

/**
 * Four bars across the top. They read as redaction bars filling in rather than
 * as generic progress dots, which is the point — the product's own mark doing
 * the work (DESIGN.md §2).
 */
export default function StepIndicator({
  steps,
  current,
  onGo,
}: {
  steps: readonly Step[];
  current: number;
  /** Returns false if that step isn't reachable yet. */
  onGo: (index: number) => void;
}) {
  return (
    <nav aria-label="Progress">
      <ol className="flex gap-2">
        {steps.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <li key={step.key} className="flex-1">
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={i > current}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex min-h-11 w-full flex-col justify-center gap-1.5 text-left"
              >
                <span
                  className={`h-1.5 w-full rounded-sm ${
                    state === 'done'
                      ? 'bg-ink'
                      : state === 'current'
                        ? 'bg-stamp'
                        : 'bg-rule h-px self-center'
                  }`}
                />
                {/* Below 768px only the current step is named — four labels
                    across a 390px screen wrap into an unreadable stack
                    (DESIGN.md §6). */}
                <span
                  className={`font-mono text-[11px] tracking-wide uppercase md:inline ${
                    state === 'current' ? 'inline' : 'hidden'
                  } ${state === 'todo' ? 'text-ink-soft' : 'text-ink'}`}
                >
                  {step.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
