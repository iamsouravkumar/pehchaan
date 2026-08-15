import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OcrUnavailable, withDeadline } from './worker.ts';

test('a stalled read becomes a degrade, not a hang', async () => {
  // Tesseract stops silently when it cannot fetch an asset: the promise never
  // settles either way. Without this, the review step waits forever.
  await assert.rejects(withDeadline(new Promise(() => {}), 20), OcrUnavailable);
});

test('a read that finishes in time is untouched', async () => {
  assert.deepEqual(await withDeadline(Promise.resolve(['a']), 1000), ['a']);
});

test('a real failure surfaces as itself, not as a timeout', async () => {
  const boom = new Error('worker exploded');
  await assert.rejects(withDeadline(Promise.reject(boom), 1000), (e) => e === boom);
});
