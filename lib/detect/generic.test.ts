import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAddress, detectDates, detectLabelledNumbers } from './generic.ts';
import { detectAll } from './index.ts';
import type { Word } from '../ocr/worker.ts';

/** One line of words, left to right, 40px tall at y. */
function line(texts: string[], y = 100): Word[] {
  let x = 50;
  return texts.map((text) => {
    const w = text.length * 18;
    const word = { text, confidence: 90, x, y, w, h: 40 };
    x += w + 15;
    return word;
  });
}

test('finds a printed date of birth', () => {
  const boxes = detectDates(line(['DOB:', '01/01/1990']), 1000, 500);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].label, 'Date of birth');
});

test('accepts the separators OCR actually returns', () => {
  assert.equal(detectDates(line(['31-12-1985']), 1000, 500).length, 1);
  assert.equal(detectDates(line(['9.8.2001']), 1000, 500).length, 1);
});

test('rejects impossible dates', () => {
  assert.equal(detectDates(line(['32/01/1990']), 1000, 500).length, 0);
  assert.equal(detectDates(line(['01/13/1990']), 1000, 500).length, 0);
});

test('a bare year counts only when a label says birth', () => {
  assert.equal(detectDates(line(['1990']), 1000, 500).length, 0);
  assert.equal(detectDates(line(['Year', 'of', 'Birth:', '1990']), 1000, 500).length, 1);
});

test('an address block runs from its anchor to the PIN code', () => {
  const words = [
    ...line(['Name:', 'Aarav'], 40),
    ...line(['Address:', 'H.No', '12,', 'Nehru', 'Road'], 100),
    ...line(['Kothrud,', 'Pune'], 160),
    ...line(['Maharashtra', '411038'], 220),
    ...line(['Issued', 'by', 'the', 'authority'], 280),
  ];
  const boxes = detectAddress(words, 1000, 500);
  assert.equal(boxes.length, 1);
  const box = boxes[0];
  assert.ok(box.y < 100, 'starts at the anchor line');
  assert.ok(box.y + box.h > 220 && box.y + box.h < 280, 'stops at the PIN line, not after it');
});

test('S/O starts an address block too', () => {
  const words = [...line(['S/O', 'Ramesh', 'Kumar'], 40), ...line(['Pune', '411038'], 100)];
  assert.equal(detectAddress(words, 1000, 500).length, 1);
});

test('a label anchors the number next to it', () => {
  const boxes = detectLabelledNumbers(line(['Roll', 'No.', '2019CS4471']), 1000, 500);
  assert.equal(boxes.length, 1);
  // Heuristic, not verified — so it arrives as a suggestion.
  assert.equal(boxes[0].source, 'suggested');
});

test('a label with no number nearby finds nothing', () => {
  assert.equal(detectLabelledNumbers(line(['Roll', 'of', 'honour']), 1000, 500).length, 0);
});

test('overlapping findings collapse to one box', () => {
  // The PIN inside an address block must not also arrive as its own box.
  const words = [
    ...line(['Address:', 'H.No', '12,', 'Nehru', 'Road'], 100),
    ...line(['Pune', '411038'], 160),
    ...line(['Mobile', '9876543210'], 220),
  ];
  const boxes = detectAll(words, 1000, 500);
  const labels = boxes.map((b) => b.label).sort();
  assert.deepEqual(labels, ['Address', 'Phone number']);
});
