import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrScale, stretchContrast } from './prepare.ts';

test('scales a small page up and leaves a large one alone', () => {
  assert.ok(ocrScale(600) > 2, 'a card photographed small needs the most help');
  assert.ok(ocrScale(1200) > 1 && ocrScale(1200) < 2);
  assert.equal(ocrScale(2000), 1, 'a page already at working size is not touched');
  assert.equal(ocrScale(0), 1, 'an empty page does not divide by zero');
});

/** An image of two flat tones, as RGBA. */
function pixels(values: number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  });
  return data;
}

test('pulls faint ink and dim paper apart', () => {
  // A grey-on-grey card: ink at 110, paper at 150. Nothing near black or white.
  const data = pixels([...Array(50).fill(110), ...Array(50).fill(150)]);
  stretchContrast(data);

  assert.ok(data[0] < 40, 'the ink goes dark');
  assert.ok(data[99 * 4] > 215, 'the paper goes light');
});

test('greys a colour cast', () => {
  const data = pixels([0]);
  data[0] = 30;
  data[1] = 90;
  data[2] = 200; // a blue-lit photograph
  stretchContrast(data);
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
});

test('leaves a flat page alone rather than amplifying its noise', () => {
  const data = pixels(Array(100).fill(200));
  stretchContrast(data);
  assert.equal(data[0], 200);
});
