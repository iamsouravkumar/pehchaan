'use client';

/**
 * Zoom for the review step. Boxing a 12-digit number on a 390px screen is
 * impossible at fit-to-width, so this is a requirement on mobile rather than a
 * convenience (DESIGN.md §6).
 *
 * Discrete steps, not a pinch gesture: the overlay owns every pointer event so
 * it can draw and drag boxes, and a two-finger gesture competing with that is a
 * genuinely hard thing to get right. Buttons work with one thumb and can't
 * misfire mid-drag.
 */
const LEVELS = [1, 2, 3] as const;

export default function ZoomControl({
  zoom,
  setZoom,
}: {
  zoom: number;
  setZoom: (zoom: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-soft font-mono text-[11px] tracking-wide uppercase">Zoom</span>
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => setZoom(level)}
          aria-pressed={zoom === level}
          className={`min-h-11 min-w-11 rounded border px-2 font-mono text-xs ${
            zoom === level ? 'border-stamp bg-stamp-wash text-stamp' : 'border-rule text-ink-soft'
          }`}
        >
          {level}×
        </button>
      ))}
      {zoom > 1 && (
        <span className="text-ink-soft text-[13px]">Scroll the document to move around.</span>
      )}
    </div>
  );
}
