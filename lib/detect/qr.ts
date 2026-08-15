/**
 * QR and barcode detection.
 *
 * The QR on an Aadhaar card is not a link — it is the record. Name, date of
 * birth, gender, full address, and on newer cards a compressed photograph, all
 * encoded in the square. Someone hides the twelve digits, sees a clean black bar
 * where they used to be, and shares a document whose QR still hands over
 * everything the number would have led to.
 *
 * That is this product's worst failure mode, made worse by the fact that the
 * tool produced the confidence (PRD §12). So this is not an optional extra
 * detector; it closes a hole in the core promise.
 *
 * `BarcodeDetector` is a browser API — no dependency, nothing to vendor, no
 * network — but it only exists on Android, macOS and ChromeOS. On Windows
 * desktop Chrome, Safari and Firefox it is absent, so a geometric fallback
 * finds the symbol instead (./qrLocate.ts). Between them, every browser gets
 * QR coverage (TRD §4.2).
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Rect } from '../boxes.ts';
import { locateQr } from './qrLocate.ts';

/**
 * A QR's own quiet zone is part of the symbol. Padding a little further also
 * covers the printed frame these are usually set in, so the result reads as
 * deliberately removed rather than as a smudge.
 */
const PAD = 0.06;

type DetectedBarcode = {
  boundingBox: { x: number; y: number; width: number; height: number };
  format: string;
};

type Detector = { detect(source: HTMLCanvasElement): Promise<DetectedBarcode[]> };

/**
 * Every 2D format an Indian document might carry. PDF417 shows up on some
 * transport and government cards, and encodes just as much as a QR does.
 */
const FORMATS = ['qr_code', 'aztec', 'data_matrix', 'pdf417'];

/** Whether this browser can find QR codes at all. Safari and Firefox cannot. */
export function canDetectCodes(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis;
}

export function padCode(rect: Rect, width: number, height: number): Rect {
  // Square-ish symbols, so pad by the larger edge in both directions rather
  // than distorting a tall detection into a wider one.
  const grow = Math.max(rect.w, rect.h) * PAD;
  return clampRect(
    { x: rect.x - grow, y: rect.y - grow, w: rect.w + grow * 2, h: rect.h + grow * 2 },
    width,
    height,
  );
}

/** Boxes in the coordinate space of the canvas passed in. Never throws. */
export async function detectCodes(canvas: HTMLCanvasElement): Promise<Box[]> {
  if (!canDetectCodes()) return locateFallback(canvas);
  try {
    const Ctor = (globalThis as unknown as { BarcodeDetector: new (o: unknown) => Detector })
      .BarcodeDetector;
    // Built per call rather than cached. This runs once per page, so a cached
    // instance saves nothing measurable and makes the failure path impossible
    // to exercise in a test.
    const found = await new Ctor({ formats: FORMATS }).detect(canvas);
    return found.map((code) =>
      newBox(
        padCode(
          {
            x: code.boundingBox.x,
            y: code.boundingBox.y,
            w: code.boundingBox.width,
            h: code.boundingBox.height,
          },
          canvas.width,
          canvas.height,
        ),
        'QR code',
        'auto',
      ),
    );
  } catch {
    // A malformed symbol or an unsupported format list — try geometry before
    // giving up, since the user's document does not care why the API failed.
    return locateFallback(canvas);
  }
}

/**
 * Geometry rather than a decode, so the box arrives as a suggestion: nothing
 * confirmed that the three squares found are really a QR code.
 */
function locateFallback(canvas: HTMLCanvasElement): Box[] {
  try {
    const found = locateQr(canvas);
    if (!found) return [];
    return [newBox(padCode(found, canvas.width, canvas.height), 'QR code', 'suggested')];
  } catch {
    return [];
  }
}
