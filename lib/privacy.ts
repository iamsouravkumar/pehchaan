/**
 * The visible proof.
 *
 * The product's whole claim is that the document never leaves the device. That
 * claim is invisible — a user has to open DevTools to check it, and nobody
 * does. This counts what actually crossed the network and puts the number
 * on screen (TRD §7, DESIGN.md §7).
 *
 * What it counts is deliberate: requests to *other origins*. Our own assets —
 * the OCR engine, the WASM, the fonts — are fetched from this origin as the
 * user works, so a raw request count would climb past zero and mean nothing.
 * A request to somewhere else is the only event that could carry a document
 * away, and that is the number worth watching. If it is ever above zero,
 * something is wrong and the user deserves to see it rather than be reassured.
 */

export type Traffic = {
  /** Requests to any origin other than this one, since the page loaded. */
  offDevice: number;
  /** The hosts involved, so a non-zero count is diagnosable rather than scary. */
  hosts: string[];
};

export const NO_TRAFFIC: Traffic = { offDevice: 0, hosts: [] };

function isOffDevice(entry: PerformanceResourceTiming): boolean {
  // A cached or service-worker-served response has transferSize 0. Those never
  // touched the network, so counting them would make an offline page look like
  // it was phoning home (TRD §7).
  if (entry.transferSize === 0) return false;
  try {
    const url = new URL(entry.name);
    // blob: and data: are read out of memory. They aren't network requests, and
    // their origin parses inconsistently across engines anyway.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin !== location.origin;
  } catch {
    return false;
  }
}

/**
 * Watch resource timings and report the running total. Returns an unsubscribe.
 * Reads the entries already buffered before this ran, so nothing that happened
 * during page load is missed.
 */
export function watchTraffic(onChange: (traffic: Traffic) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  const hosts = new Set<string>();
  let count = 0;

  const record = (entries: PerformanceEntryList) => {
    let changed = false;
    for (const entry of entries) {
      if (!isOffDevice(entry as PerformanceResourceTiming)) continue;
      count++;
      hosts.add(new URL(entry.name).host);
      changed = true;
    }
    if (changed) onChange({ offDevice: count, hosts: [...hosts] });
  };

  const observer = new PerformanceObserver((list) => record(list.getEntries()));
  // `buffered` replays every entry recorded before this observer existed, so
  // page load is covered without a separate read that would double-count.
  observer.observe({ type: 'resource', buffered: true });
  return () => observer.disconnect();
}
