import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_TRAFFIC, watchTraffic } from './privacy.ts';

/**
 * PerformanceObserver and `location` are browser globals. Rather than mock the
 * whole platform, this drives watchTraffic through a minimal stand-in and
 * checks the one rule that matters: what gets counted.
 */
function withFakeBrowser(entries: { name: string; transferSize: number }[]) {
  const seen: { offDevice: number; hosts: string[] }[] = [];
  const globals = globalThis as Record<string, unknown>;
  const saved = { PerformanceObserver: globals.PerformanceObserver, location: globals.location };

  globals.location = { origin: 'https://pehchaan.app' };
  globals.PerformanceObserver = class {
    fn: (list: { getEntries: () => unknown[] }) => void;
    constructor(fn: (list: { getEntries: () => unknown[] }) => void) {
      this.fn = fn;
    }
    observe() {
      this.fn({ getEntries: () => entries });
    }
    disconnect() {}
  };

  const stop = watchTraffic((t) => seen.push(t));
  stop();
  globals.PerformanceObserver = saved.PerformanceObserver;
  globals.location = saved.location;
  return seen;
}

test('same-origin assets are not traffic off the device', () => {
  // The OCR engine and the WASM are fetched from our own origin as the user
  // works. Counting those would make the number meaningless.
  const seen = withFakeBrowser([
    { name: 'https://pehchaan.app/tesseract/eng.traineddata.gz', transferSize: 2_900_000 },
    { name: 'https://pehchaan.app/mediapipe/wasm/vision_wasm_internal.wasm', transferSize: 9_000_000 },
  ]);
  assert.deepEqual(seen, []);
});

test('a request to another origin is counted and named', () => {
  const seen = withFakeBrowser([
    { name: 'https://pehchaan.app/app.js', transferSize: 1000 },
    { name: 'https://cdn.jsdelivr.net/npm/tesseract.js', transferSize: 50_000 },
  ]);
  assert.deepEqual(seen.at(-1), { offDevice: 1, hosts: ['cdn.jsdelivr.net'] });
});

test('a cached response is not a network request', () => {
  // transferSize 0 means the service worker or the HTTP cache answered. An
  // offline page must not look like it is phoning home.
  const seen = withFakeBrowser([
    { name: 'https://fonts.gstatic.com/font.woff2', transferSize: 0 },
  ]);
  assert.deepEqual(seen, []);
});

test('data and blob URLs are not requests', () => {
  const seen = withFakeBrowser([
    { name: 'blob:https://pehchaan.app/1234', transferSize: 500 },
    { name: 'data:image/png;base64,AAAA', transferSize: 10 },
  ]);
  assert.deepEqual(seen, []);
});

test('reports nothing when the browser has no PerformanceObserver', () => {
  const globals = globalThis as Record<string, unknown>;
  const saved = globals.PerformanceObserver;
  delete globals.PerformanceObserver;
  let called = false;
  const stop = watchTraffic(() => (called = true));
  stop();
  globals.PerformanceObserver = saved;
  assert.equal(called, false);
  assert.deepEqual(NO_TRAFFIC, { offDevice: 0, hosts: [] });
});
