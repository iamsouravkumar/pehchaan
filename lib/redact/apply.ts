/**
 * Destructive redaction — the single most important file in this codebase.
 *
 * The common failure, in commercial tools as much as student ones, is drawing a
 * black rectangle as an overlay or a PDF annotation. The original is still in
 * the file and anyone can lift the rectangle off. Real documents have leaked
 * exactly this way.
 *
 * Here the source is drawn to a canvas, the regions are painted over, and the
 * canvas is re-encoded. The re-encode is what destroys the data: the output has
 * no layers and no objects, only pixels, and the original pixels are gone.
 */

import { toFullSpace, type Box, type Rect } from '../boxes.ts';
import { applyWatermark } from './watermark.ts';

/** Redaction bars are deliberately darker than body ink (DESIGN.md §3). */
const REDACT = '#0A0A0B';

/**
 * How many pixel cells a masked region is reduced to along its long edge.
 *
 * Deliberately a ratio, not an absolute block size. An absolute size collapses
 * a small region to two or three cells — which reads as arbitrary colour bands,
 * not redaction — and gives a different result on the working canvas than on
 * the full-resolution one, so the preview would be lying about the export.
 *
 * Twelve is coarse enough to destroy a face or an address line (a light blur is
 * guessable) and coarse enough that the output looks obviously redacted, which
 * PRD §7 requires.
 */
const CELLS_ACROSS = 12;

export type Region = Rect & { style: 'block' | 'blur' };

/**
 * Which regions actually get painted, in full-resolution pixel space.
 * Split out from the drawing so the coordinate maths is testable without a DOM.
 */
export function regionsFor(boxes: Box[], scaleToFull: number): Region[] {
  return boxes
    .filter((b) => b.enabled)
    .map((b) => ({ ...toFullSpace(b, scaleToFull), style: b.style }));
}

/** Returns a new canvas. The source is never mutated. */
export function redact(
  source: HTMLCanvasElement,
  boxes: Box[],
  scaleToFull: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error("This browser can't render the redacted copy.");
  ctx.drawImage(source, 0, 0);

  for (const region of regionsFor(boxes, scaleToFull)) {
    if (region.style === 'blur') pixelate(ctx, region);
    else {
      ctx.fillStyle = REDACT;
      ctx.fillRect(region.x, region.y, region.w, region.h);
    }
  }
  return out;
}

/**
 * The whole output pipeline: mask, then stamp. Used for both the on-screen
 * preview and the saved file, differing only in which canvas goes in — so the
 * preview can't drift from what gets written.
 */
export function renderDocument(
  source: HTMLCanvasElement,
  boxes: Box[],
  scaleToFull: number,
  stamp: string,
): HTMLCanvasElement {
  const out = redact(source, boxes, scaleToFull);
  if (stamp) applyWatermark(out, stamp);
  return out;
}

/** Crush the region down to a coarse grid, then blow it back up. */
function pixelate(ctx: CanvasRenderingContext2D, r: Region) {
  const cell = Math.max(r.w, r.h) / CELLS_ACROSS;
  const small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(r.w / cell));
  small.height = Math.max(2, Math.round(r.h / cell));
  const sctx = small.getContext('2d');
  if (!sctx) return;

  // Each cell must be an average of what it covers. Left on the default, the
  // browser samples instead, and a sampled cell can be any single pixel from
  // the region — including a legible one.
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, small.width, small.height);

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false; // hard blocks, not a soft smear
  ctx.drawImage(small, 0, 0, small.width, small.height, r.x, r.y, r.w, r.h);
  ctx.imageSmoothingEnabled = smoothing;

  // Outline it. A pale pixelated patch can pass for a printing artifact, and
  // the recipient has to be able to see that something was deliberately hidden.
  ctx.strokeStyle = REDACT;
  ctx.lineWidth = Math.max(1, Math.round(Math.max(r.w, r.h) / 300));
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}
