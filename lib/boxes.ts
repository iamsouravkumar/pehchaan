/**
 * Box model and geometry.
 *
 * Coordinates are in `work`-canvas pixel space (see lib/image/normalise.ts),
 * never screen space. The overlay renders them as percentages of the canvas,
 * so boxes survive zoom, window resize and any display size for free.
 *
 * Every function here is pure — the interaction layer owns pointer state, this
 * file owns what a rectangle is allowed to be.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type Box = Rect & {
  id: string;
  label: string;
  /**
   * `suggested` is a detection we are not confident in — a 12-digit group that
   * failed its checksum, most likely because OCR misread a digit. It is still
   * drawn and still enabled, because the cost of a wrong box is one click and
   * the cost of a missed Aadhaar number is the whole product (TRD §4.2).
   */
  source: 'auto' | 'suggested' | 'manual';
  style: 'block' | 'blur';
  /** Off means the region is left visible on export. */
  enabled: boolean;
};

export const LABELS = [
  'Aadhaar number',
  'PAN',
  'Date of birth',
  'Address',
  'Photograph',
  'QR code',
  'Name',
  'Phone number',
  'Roll number',
  'Account number',
  'Signature',
  'Other',
] as const;

/**
 * Blur is guessable on fixed-pitch digits, so these are always solid block.
 * A QR is on the list for a different reason: the format carries error
 * correction, so a partially destroyed symbol still decodes. Half-hidden is not
 * hidden.
 */
const BLOCK_ONLY = new Set([
  'Aadhaar number',
  'QR code',
  'PAN',
  'Date of birth',
  'Phone number',
  'Roll number',
  'Account number',
]);

/**
 * A label as it reads inside a sentence. Lowercased, except for the ones that
 * are acronyms — "found pan and aadhaar number" reads like a typo.
 */
export function spoken(label: string): string {
  return label === label.toUpperCase() ? label : label.toLowerCase();
}

export function allowsBlur(label: string): boolean {
  return !BLOCK_ONLY.has(label);
}

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Handle = (typeof HANDLES)[number];

/** Smallest usable box, in work-space pixels. */
export const MIN_SIZE = 8;

/**
 * `crypto.randomUUID` only exists in a secure context, so it is missing over
 * plain http — which is exactly how the app gets opened on a phone from a LAN
 * address during testing. A box id is a React key and a selection handle;
 * nothing here needs cryptographic randomness, and throwing on the one device
 * this product is designed for would be a poor trade for that guarantee.
 */
function boxId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `box-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function newBox(rect: Rect, label = 'Other', source: Box['source'] = 'manual'): Box {
  return {
    ...rect,
    id: boxId(),
    label,
    source,
    style: 'block',
    enabled: true,
  };
}

/** Turn a drag-produced rect with negative extents into a positive one. */
export function normaliseRect(r: Rect): Rect {
  return {
    x: r.w < 0 ? r.x + r.w : r.x,
    y: r.h < 0 ? r.y + r.h : r.y,
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

/** Keep a rect inside the canvas, shrinking it if needed. */
export function clampRect(r: Rect, W: number, H: number): Rect {
  const x = Math.min(Math.max(r.x, 0), Math.max(W - MIN_SIZE, 0));
  const y = Math.min(Math.max(r.y, 0), Math.max(H - MIN_SIZE, 0));
  return {
    x,
    y,
    w: Math.min(Math.max(r.w, MIN_SIZE), W - x),
    h: Math.min(Math.max(r.h, MIN_SIZE), H - y),
  };
}

/** Translate without changing size — a move that hits the edge stops, not shrinks. */
export function moveRect(r: Rect, dx: number, dy: number, W: number, H: number): Rect {
  return {
    ...r,
    x: Math.min(Math.max(r.x + dx, 0), Math.max(W - r.w, 0)),
    y: Math.min(Math.max(r.y + dy, 0), Math.max(H - r.h, 0)),
  };
}

/**
 * Drag a handle. Dragging past the opposite edge flips the rect rather than
 * collapsing it, which is what every drawing tool does and what hands expect.
 */
export function resizeRect(
  r: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  W: number,
  H: number,
): Rect {
  const next = { ...r };
  if (handle.includes('w')) {
    next.x = r.x + dx;
    next.w = r.w - dx;
  }
  if (handle.includes('e')) next.w = r.w + dx;
  if (handle.includes('n')) {
    next.y = r.y + dy;
    next.h = r.h - dy;
  }
  if (handle.includes('s')) next.h = r.h + dy;
  return clampRect(normaliseRect(next), W, H);
}

/** Work-space rect scaled into full-resolution pixel space for redaction. */
export function toFullSpace(r: Rect, scaleToFull: number): Rect {
  return {
    x: Math.round(r.x * scaleToFull),
    y: Math.round(r.y * scaleToFull),
    w: Math.round(r.w * scaleToFull),
    h: Math.round(r.h * scaleToFull),
  };
}
