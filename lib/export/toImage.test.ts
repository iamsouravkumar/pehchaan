import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor, redactedName } from './toImage.ts';

test('filename carries the branding, the document does not', () => {
  assert.equal(redactedName('Aadhaar Front.jpg', 'jpg'), 'aadhaar-front-redacted-pehchaan.jpg');
  assert.equal(redactedName('IMG_20260814_101530.png', 'png'), 'img-20260814-101530-redacted-pehchaan.png');
});

test('filename survives awkward source names', () => {
  assert.equal(redactedName('.jpg', 'jpg'), 'document-redacted-pehchaan.jpg');
  assert.equal(redactedName('scan..final.v2.jpeg', 'jpg'), 'scan-final-v2-redacted-pehchaan.jpg');
});

test('PNG stays lossless, everything else encodes as JPEG', () => {
  assert.deepEqual(formatFor('image/png'), { mime: 'image/png', extension: 'png' });
  assert.deepEqual(formatFor('image/jpeg'), { mime: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(formatFor('image/webp'), { mime: 'image/jpeg', extension: 'jpg' });
});
