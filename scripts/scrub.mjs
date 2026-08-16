/**
 * Removes third-party CDN URLs from everything we ship.
 *
 * Tesseract carries hardcoded jsDelivr defaults for its worker, its WASM core
 * and its language data. We override all three (lib/ocr/worker.ts), so the
 * strings are dead code, but they sit in the bundle of a product whose entire
 * claim is that there is nowhere for your document to go, and "it's unreachable,
 * trust me" is a worse answer than not having it there.
 *
 * Rewriting to a same-origin path means that if one of those defaults ever did
 * become live (a version bump changing an option name, a path we forget to set),
 * it fails loudly with a 404 from our own server instead of quietly fetching
 * several megabytes from someone else's. The failure mode goes from invisible to
 * obvious, which is the whole point (TRD §4.1).
 */

const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'storage.googleapis.com',
];

/** Matches an absolute URL to any host above, up to the first quote or space. */
export const CDN_URL = new RegExp(
  `https?://(?:[a-zA-Z0-9-]+\\.)*(?:${CDN_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})`,
  'g',
);

/** A path that cannot leave the origin, and that names itself in a stack trace. */
const REPLACEMENT = '/pehchaan-never-fetches-a-cdn';

export function scrub(text) {
  return text.replace(CDN_URL, REPLACEMENT);
}

/** Every CDN URL left in the text, for the build-time assertion. */
export function findCdnUrls(text) {
  return [...new Set(text.match(CDN_URL) ?? [])];
}
