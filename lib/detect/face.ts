/**
 * Photograph detection.
 *
 * A face is the one identifying field OCR can never find, and on an ID card it
 * is usually the field people forget. MediaPipe's short-range BlazeFace runs
 * locally on WASM; like Tesseract it defaults to a Google CDN for both its
 * runtime and its model, and like Tesseract both paths are overridden here and
 * vendored by scripts/copy-assets.mjs (TRD §4.2, §7).
 *
 * If it can't load, the app carries on without it. Nothing here is allowed to
 * block the review step.
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Rect } from '../boxes.ts';
import { contrastSpread, stretchContrast } from '../ocr/prepare.ts';

/** Where copy-assets.mjs puts the runtime and the model. */
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/blaze_face_short_range.tflite';

/**
 * A face box is the face; an ID photograph is a head, shoulders, and a margin
 * of background around them. Covering only the face leaves the frame of the
 * photo, the hairline and the shoulders visible, which is still recognisably a
 * picture of someone (TRD §4.2).
 */
const EXPAND = 0.4;

/**
 * What a whole-page detection has to score. The model's own floor of 0.3 let a
 * table of marks through as a photograph on a real marksheet; a face that only
 * scores that badly on the whole page is found properly by the window passes
 * below, which run whenever this one comes back empty.
 */
const PAGE_SCORE = 0.5;
/** What a detection found inside a half-page window has to score to be believed. */
const WINDOW_SCORE = 0.5;
/** And inside a quarter-page one, where there is less context to be wrong about. */
const FINE_SCORE = 0.7;
/** The most of a page one photograph may plausibly cover. */
const MAX_AREA = 0.4;
/**
 * A head is about as tall as it is wide, and the box is grown evenly around it,
 * so a photograph box stays near square. A block of a document that happens to
 * look like a face — a ruled table, a grid of marks — comes back long and flat.
 */
const ASPECT = [0.55, 1.8] as const;

type Detector = {
  detect(image: HTMLCanvasElement): { detections: RawDetection[] };
};
type RawDetection = {
  boundingBox?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  categories?: { score: number }[];
};

let detector: Promise<Detector> | null = null;

async function get(): Promise<Detector> {
  if (!detector) {
    detector = load().catch((cause) => {
      detector = null; // a later page can try again rather than inherit the failure
      throw new Error('Face detection is unavailable.', { cause });
    });
  }
  return detector;
}

async function load(): Promise<Detector> {
  // Dynamic so the ~200 KB loader stays out of the initial bundle and never
  // runs during the static export.
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
  return (await vision.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: 'IMAGE',
    // Low, on purpose. A missed photograph is the expensive error, and a box
    // over a face-like smudge costs one click to remove.
    minDetectionConfidence: 0.3,
  })) as unknown as Detector;
}

/** Grow a face box into a photograph box, keeping it on the page. */
export function expandFace(rect: Rect, width: number, height: number): Rect {
  const grow = { x: rect.w * EXPAND, y: rect.h * EXPAND };
  return clampRect(
    {
      x: rect.x - grow.x,
      y: rect.y - grow.y,
      w: rect.w + grow.x * 2,
      h: rect.h + grow.y * 2,
    },
    width,
    height,
  );
}

/**
 * How much of the page each pass looks at, coarsest first.
 *
 * The model resizes whatever it is given to 128 pixels square and wants a face
 * filling a good part of that. What decides whether a photograph survives is
 * therefore the fraction of the *frame* it occupies, not how many pixels it
 * has: drawing a window larger before handing it over changes nothing, because
 * the model shrinks it back down again.
 *
 * So the frame gets smaller instead. An Aadhaar photograph is around a tenth of
 * the card and comes back at the half-size pass. A PAN photograph is smaller
 * still, and low-contrast greyscale print besides, so it needs the quarter pass
 * where it fills better than half the window.
 */
const LEVELS = [1, 1 / 2, 1 / 4];

/**
 * A grid of windows covering the page, each `fraction` of it across, stepping
 * by half a window so a face never falls on a seam and gets halved in every
 * frame it appears in.
 */
export function windows(width: number, height: number, fraction: number): Rect[] {
  if (fraction >= 1) return [{ x: 0, y: 0, w: width, h: height }];

  const w = width * fraction;
  const h = height * fraction;
  const steps = Math.round(1 / fraction) * 2 - 1;
  const frames: Rect[] = [];

  for (let row = 0; row < steps; row++) {
    for (let column = 0; column < steps; column++) {
      frames.push({ x: (column * w) / 2, y: (row * h) / 2, w, h });
    }
  }
  return frames;
}

/** Drop a detection that lands on top of one already found. */
function isNew(kept: Box[], candidate: Box): boolean {
  return !kept.some((box) => overlap(box, candidate) > 0.4);
}

/** Shared area as a fraction of the smaller box. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/** Run the model over one frame, in the coordinates of the page. */
function detectIn(detector: Detector, canvas: HTMLCanvasElement, frame: Rect): Box[] {
  const whole = frame.w >= canvas.width;
  let source = canvas;

  if (!whole) {
    const tile = document.createElement('canvas');
    tile.width = Math.round(frame.w);
    tile.height = Math.round(frame.h);
    const ctx = tile.getContext('2d');
    if (!ctx) return [];
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, frame.x, frame.y, frame.w, frame.h, 0, 0, tile.width, tile.height);
    source = tile;
  }

  // A window of blank card is a featureless grey rectangle, and the model calls
  // those faces at a low score often enough to matter: measured on a blank card
  // here, half-page windows produced up to 0.32 and quarter-page windows up to
  // 0.51. The smaller the frame, the less there is in it to rule a face out, so
  // the floor rises as the frames shrink. The whole-page pass keeps the model's
  // own threshold, which was already proven on real documents.
  const floor = whole ? PAGE_SCORE : frame.w >= canvas.width / 2 ? WINDOW_SCORE : FINE_SCORE;

  return detector
    .detect(source)
    .detections.filter((d) => (d.categories?.[0]?.score ?? 1) >= floor)
    .map((d) => d.boundingBox)
    .filter((b) => b !== undefined)
    .map((b) =>
      expandFace(
        { x: frame.x + b.originX, y: frame.y + b.originY, w: b.width, h: b.height },
        canvas.width,
        canvas.height,
      ),
    )
    // A photograph on a document is a stamp in a corner, not the document. The
    // model will occasionally return most of a page as one detection, and that
    // box hides the very fields the user is trying to check.
    .filter((rect) => rect.w * rect.h <= canvas.width * canvas.height * MAX_AREA)
    .filter((rect) => rect.h > 0 && rect.w / rect.h >= ASPECT[0] && rect.w / rect.h <= ASPECT[1])
    .map((rect) => newBox(rect, 'Photograph', 'auto'));
}

/**
 * A page small enough to search quickly.
 *
 * The model reduces everything to 128 pixels square, so a 1240×1750 scan buys
 * nothing but cost: every window has to be cut out of it and redrawn, sixty
 * times over. Shrinking the page once at the start makes all of that cheap, and
 * the boxes scale back up exactly.
 */
const SEARCH_EDGE = 900;

function shrink(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.min(1, SEARCH_EDGE / Math.max(canvas.width, canvas.height));
  if (scale === 1) return { canvas, scale: 1 };

  const small = document.createElement('canvas');
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  const ctx = small.getContext('2d');
  if (!ctx) return { canvas, scale: 1 };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return { canvas: small, scale };
}

/**
 * The same page with its contrast pulled apart, or null when there is nothing
 * to gain: a page that already uses most of the grey scale would come back
 * unchanged, and searching it again is the whole cost for none of the benefit.
 */
function lifted(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  try {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(canvas, 0, 0);
    const image = ctx.getImageData(0, 0, copy.width, copy.height);
    if (contrastSpread(image.data) > 150) return null;

    stretchContrast(image.data);
    ctx.putImageData(image, 0, 0);
    return copy;
  } catch {
    return null;
  }
}

/** Boxes in the coordinate space of the canvas passed in. Never throws. */
export async function detectFaces(canvas: HTMLCanvasElement): Promise<Box[]> {
  try {
    const detector = await get();
    const { canvas: page, scale } = shrink(canvas);
    const found: Box[] = [];

    // Each pass is finer and costs more, so stop at the first that finds
    // anything. A document with a normal-sized photograph never reaches the
    // quarter-page pass, and one with nothing on it pays for all three.
    //
    // The whole search then runs a second time on a contrast-stretched copy,
    // because a marksheet photograph is not a photograph: it is a scan of a
    // photocopy of one, flat and grey, with the tonal range the model reads
    // faces by squeezed into a fraction of the scale. Pulling it back apart
    // costs one pass over the pixels.
    for (const version of [page, lifted(page)]) {
      if (!version) continue;
      for (const fraction of LEVELS) {
        for (const frame of windows(version.width, version.height, fraction)) {
          for (const box of detectIn(detector, version, frame)) {
            if (isNew(found, box)) found.push(box);
          }
        }
        if (found.length) break;
      }
      if (found.length) break;
    }

    // Back into the coordinates of the page that was handed in.
    return scale === 1
      ? found
      : found.map((box) => ({
          ...box,
          x: box.x / scale,
          y: box.y / scale,
          w: box.w / scale,
          h: box.h / scale,
        }));
  } catch {
    return [];
  }
}
