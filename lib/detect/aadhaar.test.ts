import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAadhaar } from './aadhaar.ts';
import type { Word } from '../ocr/worker.ts';

/** Words laid out left to right on one line, 40px tall at y. */
function line(texts: string[], y = 100): Word[] {
  let x = 50;
  return texts.map((text) => {
    const w = text.length * 20;
    const word = { text, confidence: 90, x, y, w, h: 40 };
    x += w + 15;
    return word;
  });
}

test('joins three printed groups into one detection', () => {
  const boxes = detectAadhaar(line(['2345', '6789', '0124']), 1000, 500);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].label, 'Aadhaar number');
  assert.equal(boxes[0].source, 'auto');
  // Covers all three groups, with padding, not just the first.
  assert.ok(boxes[0].x < 50 && boxes[0].w > 250);
});

test('a failed checksum is suggested, never dropped', () => {
  // One digit misread. Still almost certainly an Aadhaar number.
  const boxes = detectAadhaar(line(['2345', '6789', '0123']), 1000, 500);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].source, 'suggested');
});

test('ignores 12-digit runs that cannot be Aadhaar numbers', () => {
  assert.equal(detectAadhaar(line(['0123', '4567', '8901']), 1000, 500).length, 0);
  assert.equal(detectAadhaar(line(['1234', '5678', '9012']), 1000, 500).length, 0);
});

test('reads a number OCR returned with letter confusions', () => {
  // O read for 0, I read for 1, and a separator printed inside a group.
  const boxes = detectAadhaar(line(['23-45', '6789', 'OI24']), 1000, 500);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].source, 'auto');
});

test('does not pair two unrelated numbers into a false positive', () => {
  // Six digits then six digits, separated by a word — not one run.
  assert.equal(detectAadhaar(line(['234567', 'PIN', '890124']), 1000, 500).length, 0);
});

test('does not read letters as digits', () => {
  assert.equal(detectAadhaar(line(['SOBI', 'OSIS', 'BOSI']), 1000, 500).length, 0);
});

test('finds numbers on separate lines independently', () => {
  const words = [...line(['2345', '6789', '0124'], 100), ...line(['3456', '7890', '1238'], 300)];
  const boxes = detectAadhaar(words, 1000, 500);
  assert.equal(boxes.length, 2);
  assert.ok(boxes.every((b) => b.source === 'auto'));
});

test('boxes stay inside the canvas', () => {
  const boxes = detectAadhaar(line(['2345', '6789', '0124'], 0), 400, 60);
  assert.ok(boxes[0].x >= 0 && boxes[0].y >= 0);
  assert.ok(boxes[0].x + boxes[0].w <= 400 && boxes[0].y + boxes[0].h <= 60);
});
