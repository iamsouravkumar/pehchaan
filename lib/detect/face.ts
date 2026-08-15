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

/** Where copy-assets.mjs puts the runtime and the model. */
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/blaze_face_short_range.tflite';

/**
 * A face box is the face — an ID photograph is a head, shoulders, and a margin
 * of background around them. Covering only the face leaves the frame of the
 * photo, the hairline and the shoulders visible, which is still recognisably a
 * picture of someone (TRD §4.2).
 */
const EXPAND = 0.4;

type Detector = { detect(image: HTMLCanvasElement): { detections: RawDetection[] } };
type RawDetection = {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
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

/** Boxes in the coordinate space of the canvas passed in. Never throws. */
export async function detectFaces(canvas: HTMLCanvasElement): Promise<Box[]> {
  try {
    const { detections } = (await get()).detect(canvas);
    return detections
      .map((d) => d.boundingBox)
      .filter((b) => b !== undefined)
      .map((b) =>
        newBox(
          expandFace(
            { x: b.originX, y: b.originY, w: b.width, h: b.height },
            canvas.width,
            canvas.height,
          ),
          'Photograph',
          'auto',
        ),
      );
  } catch {
    return [];
  }
}
