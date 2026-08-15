/**
 * Decode a dropped file into canvases the rest of the pipeline can use.
 *
 * Two outputs, deliberately:
 *   `full` — the resolution the export is rendered at, so output quality
 *            matches what the user gave us.
 *   `work` — downscaled to OCR_MAX_EDGE, used for detection and on-screen
 *            display so a 12MP phone photo doesn't freeze the tab (TRD §8).
 *
 * Box coordinates live in `work` pixel space and scale up by `scaleToFull`.
 *
 * EXIF orientation is applied by createImageBitmap; drawing to a canvas then
 * drops every other metadata field, GPS included (TRD §7).
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'] as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const OCR_MAX_EDGE = 2000;

export type NormalisedImage = {
  full: HTMLCanvasElement;
  work: HTMLCanvasElement;
  /** Multiply a `work`-space coordinate by this to reach `full` space. */
  scaleToFull: number;
  /** Original filename and MIME type, used only to name and encode the export. */
  sourceName: string;
  sourceType: string;
};

export class NormaliseError extends Error {}

export function isPdf(type: string): boolean {
  return type === 'application/pdf';
}

/** Reject at the drop with a specific reason, never a generic error (TRD §10). */
export function checkFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "That file type isn't supported. Use a JPG, PNG, WEBP or PDF.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${Math.round(file.size / 1024 / 1024)} MB. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/**
 * Derive the working pair from an already-rasterised page. PDF pages and camera
 * photos both land here, so everything downstream sees one shape.
 */
export function normaliseCanvas(
  full: HTMLCanvasElement,
  sourceName: string,
  sourceType: string,
): NormalisedImage {
  const longEdge = Math.max(full.width, full.height);
  const ratio = Math.min(1, OCR_MAX_EDGE / longEdge);
  // ponytail: single-step downscale. Swap to halving passes if OCR recall
  // suffers on large photos — measure before adding the loop.
  const work =
    ratio === 1
      ? full
      : drawTo(full, Math.round(full.width * ratio), Math.round(full.height * ratio));
  return { full, work, scaleToFull: 1 / ratio, sourceName, sourceType };
}

export async function normalise(file: File): Promise<NormalisedImage> {
  const reason = checkFile(file);
  if (reason) throw new NormaliseError(reason);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new NormaliseError("Couldn't read this file. Try a clearer photo.");
  }

  try {
    return normaliseCanvas(drawTo(bitmap, bitmap.width, bitmap.height), file.name, file.type);
  } finally {
    bitmap.close();
  }
}

export function blankCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function drawTo(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = blankCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new NormaliseError("This browser can't render the document.");
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}
