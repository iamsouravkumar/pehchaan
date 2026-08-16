'use client';

import { useEffect, useRef } from 'react';

/**
 * Mounts the working canvas and gives the box overlay something to sit on.
 *
 * The canvas node from `normalise()` is mounted directly rather than copied, so
 * the overlay's `inset-0` matches the document's on-screen geometry exactly:
 * one source of truth, no scale bookkeeping, correct after any resize.
 *
 * Zoom works by widening the canvas inside a scrolling frame. Boxes are
 * positioned as percentages of the canvas, so they follow for free and no
 * coordinate anywhere needs to know the zoom exists (DESIGN.md §6).
 *
 * The stage is always white, in any theme: you can't judge what's visible on a
 * scan sitting against tinted chrome (DESIGN.md §3).
 */
export default function DocumentCanvas({
  canvas,
  zoom = 1,
  children,
}: {
  canvas: HTMLCanvasElement;
  /** 1 fits the frame; above that the frame scrolls. */
  zoom?: number;
  children?: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    canvas.className = 'block h-auto w-full';
    node.prepend(canvas);
    return () => canvas.remove();
  }, [canvas]);

  return (
    // min-w-0 so this can actually shrink inside the flex row instead of
    // pushing the findings panel off the screen.
    <div className="border-rule bg-surface max-h-[75vh] w-full min-w-0 flex-1 overflow-auto rounded-lg border p-3">
      <div style={{ width: `${zoom * 100}%` }}>
        <div ref={host} className="relative block bg-white leading-none">
          {children}
        </div>
      </div>
    </div>
  );
}
