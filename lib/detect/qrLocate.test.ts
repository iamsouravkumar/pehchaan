import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  binarise,
  boundsFrom,
  darkRatio,
  findCentres,
  isFinderRatio,
  scalesFor,
} from './qrLocate.ts';

const MODULE = 5;
const SIZE = 400;

/** White page with black drawn into it, as RGBA. */
function page(width = SIZE, height = SIZE) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const fill = (x: number, y: number, w: number, h: number) => {
    for (let py = Math.round(y); py < Math.round(y + h); py++) {
      for (let px = Math.round(x); px < Math.round(x + w); px++) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const p = (py * width + px) * 4;
        data[p] = data[p + 1] = data[p + 2] = 0;
      }
    }
  };
  return { data, width, height, fill };
}

/** A finder pattern: 7×7 dark, 5×5 light, 3×3 dark, in modules. */
function finder(
  fill: (x: number, y: number, w: number, h: number) => void,
  x: number,
  y: number,
  m = MODULE,
) {
  fill(x, y, m * 7, m * 7);
  fill(x + m, y + m, m * 5, m * 5);
  // The light ring is painted by re-whitening, so draw the core last instead.
  fill(x + m * 2, y + m * 2, m * 3, m * 3);
}

/** White out the ring between the outer square and the core. */
function finderProper(
  data: Uint8ClampedArray,
  width: number,
  fillDark: (x: number, y: number, w: number, h: number) => void,
  x: number,
  y: number,
  m = MODULE,
) {
  fillDark(x, y, m * 7, m * 7);
  for (let py = y + m; py < y + m * 6; py++) {
    for (let px = x + m; px < x + m * 6; px++) {
      const p = (py * width + px) * 4;
      data[p] = data[p + 1] = data[p + 2] = 255;
    }
  }
  fillDark(x + m * 2, y + m * 2, m * 3, m * 3);
}

test('recognises the 1:1:3:1:1 run signature', () => {
  assert.ok(isFinderRatio([5, 5, 15, 5, 5]));
  assert.ok(isFinderRatio([4, 5, 16, 5, 5]), 'small print variation is still a finder');
  assert.ok(!isFinderRatio([5, 5, 5, 5, 5]), 'even runs are not a finder');
  assert.ok(!isFinderRatio([5, 5, 30, 5, 5]));
  assert.ok(!isFinderRatio([1, 1, 3, 1, 1]), 'below the minimum module size');
});

test('binarises a page into dark and light', () => {
  const p = page(40, 40);
  p.fill(10, 10, 20, 20);
  const grid = binarise(p.data, p.width, p.height);
  assert.equal(grid.dark[0], 0, 'the margin is light');
  assert.equal(grid.dark[20 * 40 + 20], 1, 'the square is dark');
});

test('locates a symbol from its three finder patterns', () => {
  const p = page();
  const origin = 100;
  const span = MODULE * 25; // a version-2 symbol, roughly
  for (const [x, y] of [
    [origin, origin],
    [origin + span, origin],
    [origin, origin + span],
  ]) {
    finderProper(p.data, p.width, p.fill, x, y);
  }

  const bounds = boundsFrom(findCentres(binarise(p.data, p.width, p.height)));
  assert.ok(bounds, 'three finders should locate a symbol');

  // Covers all three patterns. Centres are recovered from rows sampled every
  // third line, so allow a module of slack rather than demanding exactness;
  // padCode() adds a further margin before this becomes a box.
  assert.ok(bounds.x <= origin + MODULE && bounds.y <= origin + MODULE);
  assert.ok(bounds.x + bounds.w >= origin + span + MODULE * 7);
  assert.ok(bounds.y + bounds.h >= origin + span + MODULE * 7);
  // And is not the whole page.
  assert.ok(bounds.w < SIZE * 0.9);
});

test('a page with no symbol locates nothing', () => {
  const p = page();
  // Lines of "text": dark runs, but nothing with the finder proportions.
  for (let line = 0; line < 8; line++) {
    for (let word = 0; word < 6; word++) {
      p.fill(40 + word * 55, 40 + line * 40, 38, 12);
    }
  }
  assert.equal(boundsFrom(findCentres(binarise(p.data, p.width, p.height))), null);
});

test('two finder patterns are not enough', () => {
  const p = page();
  finderProper(p.data, p.width, p.fill, 100, 100);
  finderProper(p.data, p.width, p.fill, 220, 100);
  assert.equal(boundsFrom(findCentres(binarise(p.data, p.width, p.height))), null);
});

test('finder-like matches strung along a line are not a symbol', () => {
  // The false positive from a real card: a curved rule whose stroke thickens
  // and thins passes the run test repeatedly, but the matches lie along the
  // curve rather than at three corners of a square.
  const p = page();
  finderProper(p.data, p.width, p.fill, 60, 100);
  finderProper(p.data, p.width, p.fill, 180, 108);
  finderProper(p.data, p.width, p.fill, 300, 116);

  assert.equal(boundsFrom(findCentres(binarise(p.data, p.width, p.height))), null);
});

test('three corners of a square are a symbol whichever way it is turned', () => {
  // Same arrangement as the located-symbol test, rotated: the third finder
  // below-right rather than below-left. Orientation is not something we know.
  const p = page();
  const span = MODULE * 25;
  for (const [x, y] of [
    [200, 100],
    [200 + span, 100 + span],
    [200 + span, 100],
  ]) {
    finderProper(p.data, p.width, p.fill, x, y);
  }
  assert.ok(boundsFrom(findCentres(binarise(p.data, p.width, p.height))));
});

test('dark ratio separates a symbol from three marks on a white card', () => {
  const dense = page(40, 40);
  dense.fill(10, 10, 20, 10); // half the region inked
  const denseGrid = binarise(dense.data, dense.width, dense.height);
  assert.ok(darkRatio(denseGrid, { x: 10, y: 10, w: 20, h: 20 }) > 0.4);

  const sparse = page(40, 40);
  sparse.fill(10, 10, 20, 1);
  const sparseGrid = binarise(sparse.data, sparse.width, sparse.height);
  assert.ok(darkRatio(sparseGrid, { x: 10, y: 10, w: 20, h: 20 }) < 0.2);
});

// `finder` is exercised only through finderProper; keep the reference honest.
void finder;

test('a small page is searched again enlarged, a large one only once', () => {
  assert.deepEqual(scalesFor(2000), [1], 'a full-size page needs no help');
  assert.deepEqual(scalesFor(1200), [1, 2]);
  assert.deepEqual(scalesFor(500), [1, 2, 3], 'a tight crop saved small needs the most');
  assert.deepEqual(scalesFor(0), [1]);
});
