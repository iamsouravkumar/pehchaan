import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandFace, windows } from './face.ts';

// detectFaces itself needs WASM and a canvas, so it is verified in the browser.
// The expansion is the part that decides whether the export still shows a
// recognisable person, so it is pinned here.

test('grows a face box to cover the photograph around it', () => {
  const box = expandFace({ x: 200, y: 200, w: 100, h: 120 }, 1000, 1000);
  assert.equal(box.x, 160);
  assert.equal(box.y, 152);
  assert.equal(box.w, 180);
  assert.equal(box.h, 216);
});

test('a face at the edge of the page stays on the page', () => {
  const box = expandFace({ x: 0, y: 0, w: 100, h: 100 }, 400, 400);
  assert.ok(box.x >= 0 && box.y >= 0);
  assert.ok(box.x + box.w <= 400 && box.y + box.h <= 400);
});

test('a face filling the page does not push the box off it', () => {
  const box = expandFace({ x: 10, y: 10, w: 380, h: 380 }, 400, 400);
  assert.equal(box.x, 0);
  assert.equal(box.y, 0);
  assert.equal(box.w, 400);
  assert.equal(box.h, 400);
});

test('windows cover the page, and every point of it', () => {
  assert.deepEqual(windows(1000, 600, 1), [{ x: 0, y: 0, w: 1000, h: 600 }]);

  for (const fraction of [1 / 2, 1 / 4]) {
    const frames = windows(1000, 600, fraction);

    // Every window sits inside the page.
    for (const f of frames) {
      assert.ok(f.x >= 0 && f.y >= 0);
      assert.ok(f.x + f.w <= 1000.001 && f.y + f.h <= 600.001);
    }

    // And no point of the page falls outside every window: a photograph in any
    // corner or dead centre still gets looked at close up.
    for (const [x, y] of [
      [5, 5],
      [995, 595],
      [500, 300],
      [250, 550],
    ]) {
      assert.ok(
        frames.some((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h),
        `no window of ${fraction} contains ${x},${y}`,
      );
    }
  }
});

test('a finer pass looks at smaller frames', () => {
  const half = windows(1000, 600, 1 / 2);
  const quarter = windows(1000, 600, 1 / 4);
  assert.equal(half.length, 9);
  assert.equal(quarter.length, 49);
  assert.ok(quarter[0].w < half[0].w, 'a PAN photograph fills more of a smaller frame');
});
