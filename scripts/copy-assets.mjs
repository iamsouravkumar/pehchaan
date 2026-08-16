/**
 * Vendors runtime assets from node_modules into /public.
 *
 * These libraries load helper files at runtime and default to a CDN when they
 * can't find them locally. A CDN fetch would break the one claim this product
 * rests on, and it fails silently; the app still works, it just quietly talks
 * to someone else's server. So the files are copied here at build time and the
 * paths are overridden in code (TRD §7).
 *
 * Run by `prebuild` and `predev`, not committed, so a dependency bump can never
 * leave a stale copy behind.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { findCdnUrls, scrub } from './scrub.mjs';

const CORE = 'node_modules/tesseract.js-core';
const LANG = 'node_modules/@tesseract.js-data/eng';
const VISION = 'node_modules/@mediapipe/tasks-vision';

const ASSETS = [
  ['node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdf/pdf.worker.min.mjs'],

  ['node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker.min.js'],

  // Tesseract picks a core at runtime from the device's WebAssembly SIMD
  // support, so all three LSTM variants ship. Only one is ever fetched; the
  // alternative is guessing a device capability we cannot test for here.
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].flatMap(
    (name) => [
      [`${CORE}/${name}.wasm.js`, `public/tesseract/${name}.wasm.js`],
      [`${CORE}/${name}.wasm`, `public/tesseract/${name}.wasm`],
    ],
  ),

  // `4.0.0_best_int` is the LSTM-only model: 2.9 MB against 10.9 MB for the
  // build that also carries the legacy engine we never run.
  [`${LANG}/4.0.0_best_int/eng.traineddata.gz`, 'public/tesseract/lang/eng.traineddata.gz'],

  // MediaPipe picks SIMD or plain WASM from what the device supports, and both
  // its loader and its .wasm default to a Google CDN if they aren't found here.
  ...['vision_wasm_internal', 'vision_wasm_nosimd_internal'].flatMap((name) => [
    [`${VISION}/wasm/${name}.js`, `public/mediapipe/wasm/${name}.js`],
    [`${VISION}/wasm/${name}.wasm`, `public/mediapipe/wasm/${name}.wasm`],
  ]),

  // The face model isn't published to npm; Google serves it from a bucket. It
  // is checked into vendor/ so a build never reaches the network for it, and so
  // the version can't change under us between builds.
  ['vendor/blaze_face_short_range.tflite', 'public/mediapipe/blaze_face_short_range.tflite'],
];

for (const [from, to] of ASSETS) {
  const target = resolve(to);
  await mkdir(dirname(target), { recursive: true });

  // Script assets get their hardcoded CDN defaults rewritten on the way in;
  // Tesseract's worker carries three of them. Binaries are copied untouched.
  if (to.endsWith('.js') || to.endsWith('.mjs')) {
    const source = await readFile(resolve(from), 'utf8');
    const cleaned = scrub(source);
    await writeFile(target, cleaned);
    const removed = findCdnUrls(source).length;
    console.log(`vendored ${to}${removed ? ` (${removed} CDN URL${removed > 1 ? 's' : ''} rewritten)` : ''}`);
  } else {
    await copyFile(resolve(from), target);
    console.log(`vendored ${to}`);
  }
}
