import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandFace } from './face.ts';

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
