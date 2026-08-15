/**
 * Tesseract lifecycle.
 *
 * Three separate paths default to jsDelivr — the worker script, the WASM core,
 * and the language data. Getting any of them wrong doesn't throw: the app keeps
 * working while quietly fetching several megabytes from someone else's server,
 * which is the one failure this product cannot survive. All three are overridden
 * below and vendored by scripts/copy-assets.mjs (TRD §4.1).
 *
 * If OCR can't start, the app degrades to fully manual redaction rather than
 * breaking. A manual redaction tool is still a working product (TRD §10).
 */

import type { Worker } from 'tesseract.js';

export type Word = {
  text: string;
  confidence: number;
  /** Pixel box in the coordinate space of the canvas that was passed in. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type OcrStage = 'idle' | 'starting' | 'reading' | 'ready' | 'unavailable';

let worker: Promise<Worker> | null = null;

async function start(): Promise<Worker> {
  const { createWorker, OEM } = await import('tesseract.js');
  return createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract', // a directory: the right SIMD variant is chosen inside
    langPath: '/tesseract/lang',
    // Tesseract caches the language data in IndexedDB by default. We promise no
    // storage at all, and a judge who opens the Application tab should find it
    // empty. The HTTP cache already covers repeat loads (TRD §7).
    cacheMethod: 'none',
    gzip: true,
    legacyCore: false,
    legacyLang: false,
  });
}

/**
 * Begin loading the engine before the user picks a file. The first load pulls
 * roughly 6 MB and takes seconds; doing it on demand puts that wait in the
 * middle of the flow (TRD §8).
 */
export function prewarm(): void {
  void get().catch(() => {});
}

function get(): Promise<Worker> {
  if (!worker) {
    worker = start().catch((cause) => {
      worker = null; // let a later attempt retry rather than caching the failure
      throw new OcrUnavailable('Automatic detection is unavailable.', { cause });
    });
  }
  return worker;
}

export class OcrUnavailable extends Error {}

/**
 * Generous: a first load pulls several megabytes and a big page takes seconds
 * to recognise on a phone. But it must be finite. When Tesseract can't fetch an
 * asset it neither resolves nor rejects — it simply stops, and without a
 * deadline the review step would sit on "Looking for sensitive fields…"
 * forever. A stalled promise has to become a visible degrade (TRD §10).
 */
const OCR_DEADLINE_MS = 60_000;

export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new OcrUnavailable('Automatic detection timed out.')),
      ms,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Recognised words with boxes. The raw text alone is useless — we need where. */
export async function readWords(canvas: HTMLCanvasElement): Promise<Word[]> {
  const { data } = await withDeadline(
    get().then((engine) => engine.recognize(canvas, {}, { blocks: true })),
    OCR_DEADLINE_MS,
  );

  return (data.blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])
    .flatMap((paragraph) => paragraph.lines ?? [])
    .flatMap((line) => line.words ?? [])
    .map((word) => ({
      text: word.text,
      confidence: word.confidence,
      x: word.bbox.x0,
      y: word.bbox.y0,
      w: word.bbox.x1 - word.bbox.x0,
      h: word.bbox.y1 - word.bbox.y0,
    }))
    .filter((word) => word.text.trim().length > 0);
}

/** Release the engine. Only used when the whole document is cleared. */
export async function shutdown(): Promise<void> {
  const pending = worker;
  worker = null;
  if (pending) await pending.then((w) => w.terminate()).catch(() => {});
}
