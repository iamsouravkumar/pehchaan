'use client';

import { useRef, useState } from 'react';
import {
  HANDLES,
  MIN_SIZE,
  clampRect,
  moveRect,
  newBox,
  normaliseRect,
  resizeRect,
  type Box,
  type Handle,
  type Rect,
} from '@/lib/boxes';

type Drag =
  /** `rect` is the live draft. It lives here, not in state, so the commit on
   *  pointerup never depends on React having re-rendered first. */
  | { kind: 'draw'; startX: number; startY: number; rect: Rect | null }
  | { kind: 'move'; id: string; startX: number; startY: number; from: Rect }
  | {
      kind: 'resize';
      id: string;
      handle: Handle;
      startX: number;
      startY: number;
      from: Rect;
    };

/** Distributes over the union, so each variant keeps its own required fields. */
type WithoutStart<T> = T extends unknown ? Omit<T, 'startX' | 'startY'> : never;
type DragSpec = WithoutStart<Drag>;

const CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

// Handle renders at 12px but takes a 44px touch target via the -inset-4 halo,
// because this gets used on a 390px phone screen (DESIGN.md §6).
const HANDLE_CLASS =
  "bg-surface border-stamp absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2 after:absolute after:-inset-4 after:content-['']";

const HANDLE_POS: Record<Handle, { left: string; top: string }> = {
  nw: { left: '0%', top: '0%' },
  n: { left: '50%', top: '0%' },
  ne: { left: '100%', top: '0%' },
  e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' },
  s: { left: '50%', top: '100%' },
  sw: { left: '0%', top: '100%' },
  w: { left: '0%', top: '50%' },
};

export default function BoxOverlay({
  boxes,
  setBoxes,
  selected,
  setSelected,
  width,
  height,
  drawing,
}: {
  boxes: Box[];
  setBoxes: (update: (boxes: Box[]) => Box[]) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  /** Work-space canvas dimensions. */
  width: number;
  height: number;
  /** True while the "Draw a box" tool is armed. */
  drawing: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  /** Screen coordinates to work-space pixels. */
  function toWork(e: React.PointerEvent): { x: number; y: number } {
    const r = root.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * width,
      y: ((e.clientY - r.top) / r.height) * height,
    };
  }

  function begin(e: React.PointerEvent, d: DragSpec) {
    const p = toWork(e);
    drag.current = { ...d, startX: p.x, startY: p.y } as Drag;
    // Capture keeps a drag tracking after the pointer leaves the canvas. It
    // throws on a pointer the element doesn't own, and losing capture is far
    // better than losing the whole interaction.
    try {
      root.current!.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerDown(e: React.PointerEvent) {
    // Only a bare press on the document itself starts a new box.
    if (!drawing) {
      setSelected(null);
      return;
    }
    begin(e, { kind: 'draw', rect: null });
    const p = toWork(e);
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toWork(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;

    if (d.kind === 'draw') {
      d.rect = { x: d.startX, y: d.startY, w: dx, h: dy };
      setDraft(d.rect); // state drives the render only
      return;
    }
    const rect =
      d.kind === 'move'
        ? moveRect(d.from, dx, dy, width, height)
        : resizeRect(d.from, d.handle, dx, dy, width, height);
    setBoxes((bs) => bs.map((b) => (b.id === d.id ? { ...b, ...rect } : b)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    try {
      root.current?.releasePointerCapture(e.pointerId);
    } catch {}
    setDraft(null);
    if (d?.kind !== 'draw' || !d.rect) return;
    const rect = normaliseRect(d.rect);
    // A tap, not a drag. Don't leave a speck of a box behind.
    if (rect.w < MIN_SIZE || rect.h < MIN_SIZE) return;
    const box = newBox(clampRect(rect, width, height));
    setBoxes((bs) => [...bs, box]);
    setSelected(box.id);
  }

  function onKeyDown(e: React.KeyboardEvent, box: Box) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      setBoxes((bs) => bs.filter((b) => b.id !== box.id));
      setSelected(null);
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      setSelected(null);
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = nudge[e.key];
    if (!move) return;
    e.preventDefault();
    setBoxes((bs) =>
      bs.map((b) =>
        b.id === box.id ? { ...b, ...moveRect(b, move[0], move[1], width, height) } : b,
      ),
    );
  }

  const pct = (r: Rect) => ({
    left: `${(r.x / width) * 100}%`,
    top: `${(r.y / height) * 100}%`,
    width: `${(r.w / width) * 100}%`,
    height: `${(r.h / height) * 100}%`,
  });

  return (
    <div
      ref={root}
      className="absolute inset-0 touch-none"
      style={{ cursor: drawing ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {boxes.map((box) => {
        const isSelected = box.id === selected;
        const stroke = !box.enabled
          ? 'border-rule border opacity-40'
          : isSelected
            ? 'border-stamp border-2 bg-[var(--stamp-wash)]/60'
            : box.source === 'auto'
              ? 'border-stamp border-2'
              : // A suggestion reads as unfinished on purpose: dashed and in the
                // detection colour, so it is clearly ours and clearly unverified.
                box.source === 'suggested'
                ? 'border-stamp border-2 border-dashed'
                : 'border-ink border-2 border-dashed';
        return (
          <div
            key={box.id}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            aria-label={`${box.label}, ${Math.round((box.x / width) * 100)}% from left, ${Math.round(
              (box.y / height) * 100,
            )}% from top. Arrow keys move, Delete removes.`}
            className={`box absolute ${stroke}`}
            style={{ ...pct(box), cursor: 'move' }}
            onFocus={() => setSelected(box.id)}
            onKeyDown={(e) => onKeyDown(e, box)}
            onPointerDown={(e) => {
              setSelected(box.id);
              begin(e, { kind: 'move', id: box.id, from: box });
            }}
          >
            {isSelected &&
              HANDLES.map((h) => (
                <span
                  key={h}
                  className={HANDLE_CLASS}
                  style={{ ...HANDLE_POS[h], cursor: CURSOR[h] }}
                  onPointerDown={(e) =>
                    begin(e, {
                      kind: 'resize',
                      id: box.id,
                      handle: h,
                      from: box,
                    })
                  }
                />
              ))}
          </div>
        );
      })}

      {draft && (
        <div
          className="border-stamp pointer-events-none absolute border-2 border-dashed"
          style={pct(normaliseRect(draft))}
        />
      )}
    </div>
  );
}
