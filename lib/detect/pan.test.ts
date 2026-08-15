import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPan, readPan } from './pan.ts';
import type { Word } from '../ocr/worker.ts';

const word = (text: string, x = 50): Word => ({ text, confidence: 90, x, y: 100, w: 200, h: 40 });

test('reads a well-printed PAN', () => {
  assert.equal(readPan('ABCPE1234F'), 'ABCPE1234F');
});

test('undoes OCR confusions using the format itself', () => {
  // 0 where a letter must be, O where a digit must be, I for 1.
  assert.equal(readPan('ABC9E1234F'.replace('9', 'P')), 'ABCPE1234F');
  assert.equal(readPan('ABCPE1O34F'), 'ABCPE1034F');
  assert.equal(readPan('4BCPE1234F'.replace('4', 'A')), 'ABCPE1234F');
  assert.equal(readPan('ABCPEI234F'), 'ABCPE1234F');
});

test('rejects an invalid holder-type character', () => {
  // Fourth position must be one of P C H F A T B L J G.
  assert.equal(readPan('ABCXE1234F'), null);
});

test('rejects anything that is not the shape of a PAN', () => {
  assert.equal(readPan('ABCPE1234'), null); // too short
  assert.equal(readPan('ABCPE12345F'), null); // too long
  assert.equal(readPan('234567890124'), null); // an Aadhaar number
  assert.equal(readPan('BOOKSHELF12'), null);
});

test('labels the detection and covers the word', () => {
  const boxes = detectPan([word('ABCPE1234F')], 1000, 500);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].label, 'PAN');
  assert.equal(boxes[0].source, 'auto');
  assert.ok(boxes[0].w > 200);
});
