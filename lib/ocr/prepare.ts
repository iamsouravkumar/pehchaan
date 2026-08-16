/**
 * Making a bad photograph readable before Tesseract sees it.
 *
 * Aadhaar cards are rarely photographed well. They arrive as a WhatsApp-sized
 * JPEG of a laminated card under a ceiling light: small, dim, low contrast, and
 * with the number printed no taller than twenty pixels. Tesseract wants text
 * around thirty pixels tall and a clean separation between ink and paper, and
 * given neither it returns letters where digits are, which is how a real
 * Aadhaar number goes undetected while the larger date of birth is read fine.
 *
 * Two cheap corrections, in this order:
 *
 *   1. Upscale a small page. Interpolation invents no detail, but it gives the
 *      recogniser the stroke width it was trained on, and that alone recovers
 *      digits on a card photographed from a distance.
 *   2. Grey, then stretch the contrast between the 2nd and 98th percentiles.
 *      A flat, grey-on-grey card becomes ink on paper. Percentiles rather than
 *      min and max, because one specular highlight or one dark fold would
 *      otherwise define the whole range and nothing would move.
 *
 * Both are reversible arithmetic on a copy. The document the user sees, and the
 * one that gets exported, are untouched.
 */

/** Text below this reads poorly, so a page smaller than this gets scaled up. */
const TARGET_EDGE = 1800;
/** Beyond this, interpolation is only making the tab slower. */
const MAX_SCALE = 2.5;
/** Ignored at each end of the histogram, as a fraction of all pixels. */
const CLIP = 0.02;

/** How much to enlarge a page whose long edge is `longEdge`. Never shrinks. */
export function ocrScale(longEdge: number): number {
  if (longEdge <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(1, TARGET_EDGE / longEdge));
}

/**
 * Grey the pixels in place and stretch what is left between the clip points.
 *
 * Exported for its own test: this is the part that decides whether faint ink
 * becomes black, and it is arithmetic, not a canvas.
 */
export function stretchContrast(data: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256);
  const total = data.length / 4;

  for (let p = 0; p < data.length; p += 4) {
    // Rec. 601 luma, the same as the QR locator uses.
    const grey = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    data[p] = data[p + 1] = data[p + 2] = grey;
    histogram[grey]++;
  }

  const low = percentile(histogram, total * CLIP);
  const high = percentile(histogram, total * (1 - CLIP));
  // A page that is genuinely one flat tone has nothing to stretch, and scaling
  // by a hair's breadth would turn its noise into speckle.
  if (high - low < 16) return;

  const scale = 255 / (high - low);
  for (let p = 0; p < data.length; p += 4) {
    const value = Math.min(255, Math.max(0, (data[p] - low) * scale));
    data[p] = data[p + 1] = data[p + 2] = value;
  }
}

/**
 * How much of the grey scale the image actually uses, 0 to 255.
 *
 * A scan of a photocopy sits in a narrow band in the middle; a photograph taken
 * in daylight uses most of the range. Cheap enough to ask before deciding
 * whether a second, contrast-corrected pass over a page is worth its time.
 */
export function contrastSpread(data: Uint8ClampedArray): number {
  const histogram = new Uint32Array(256);
  const total = data.length / 4;
  for (let p = 0; p < data.length; p += 4) {
    histogram[(data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8]++;
  }
  return percentile(histogram, total * (1 - CLIP)) - percentile(histogram, total * CLIP);
}

/** The grey level at which the running count passes `target`. */
function percentile(histogram: Uint32Array, target: number): number {
  let seen = 0;
  for (let value = 0; value < 256; value++) {
    seen += histogram[value];
    if (seen >= target) return value;
  }
  return 255;
}

/**
 * A canvas prepared for recognition, and the factor its coordinates are in.
 * Divide a box from the prepared canvas by `scale` to return to page space.
 */
export function prepareForOcr(source: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  scale: number;
} {
  const scale = ocrScale(Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // No context is not a reason to fail the read; hand back the page as it is.
  if (!ctx) return { canvas: source, scale: 1 };

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  try {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    stretchContrast(image.data);
    ctx.putImageData(image, 0, 0);
  } catch {
    // A tainted canvas cannot be read back. The upscale still stands.
  }
  return { canvas, scale };
}
