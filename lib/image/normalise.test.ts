import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFile, MAX_FILE_BYTES } from './normalise.ts';

const fake = (type: string, size: number) => ({ type, size }) as File;

test('accepts supported image types', () => {
  assert.equal(checkFile(fake('image/jpeg', 1000)), null);
  assert.equal(checkFile(fake('image/png', 1000)), null);
  assert.equal(checkFile(fake('image/webp', 1000)), null);
});

test('accepts PDFs', () => {
  assert.equal(checkFile(fake('application/pdf', 1000)), null);
});

test('rejects with a specific reason, never a generic error', () => {
  assert.match(checkFile(fake('image/gif', 1000))!, /supported/);
  assert.match(checkFile(fake('image/jpeg', MAX_FILE_BYTES + 1))!, /limit/);
  assert.match(checkFile(fake('image/jpeg', 0))!, /empty/);
});
