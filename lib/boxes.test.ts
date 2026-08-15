import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SIZE,
  allowsBlur,
  clampRect,
  moveRect,
  newBox,
  normaliseRect,
  resizeRect,
  toFullSpace,
} from './boxes.ts';

const W = 100;
const H = 100;

test('a backwards drag becomes a positive rect', () => {
  assert.deepEqual(normaliseRect({ x: 50, y: 50, w: -20, h: -10 }), {
    x: 30,
    y: 40,
    w: 20,
    h: 10,
  });
});

test('clamp keeps a rect inside the canvas', () => {
  assert.deepEqual(clampRect({ x: -10, y: -10, w: 20, h: 20 }, W, H), {
    x: 0,
    y: 0,
    w: 20,
    h: 20,
  });
  const r = clampRect({ x: 90, y: 90, w: 50, h: 50 }, W, H);
  assert.ok(r.x + r.w <= W && r.y + r.h <= H);
});

test('move stops at the edge instead of shrinking', () => {
  const moved = moveRect({ x: 80, y: 10, w: 30, h: 10 }, 50, 0, W, H);
  assert.equal(moved.w, 30, 'size must survive a move into the edge');
  assert.equal(moved.x, 70);
});

test('resize from a corner moves the right edges', () => {
  const r = resizeRect({ x: 20, y: 20, w: 40, h: 40 }, 'nw', 10, 10, W, H);
  assert.deepEqual(r, { x: 30, y: 30, w: 30, h: 30 });
});

test('dragging a handle past the opposite edge flips, never collapses', () => {
  const r = resizeRect({ x: 20, y: 20, w: 40, h: 40 }, 'e', -60, 0, W, H);
  assert.ok(r.w >= MIN_SIZE, 'flipped rect must stay usable');
  assert.ok(r.x >= 0);
});

test('blur is refused on fixed-pitch digit fields', () => {
  assert.equal(allowsBlur('Aadhaar number'), false);
  assert.equal(allowsBlur('PAN'), false);
  assert.equal(allowsBlur('Photograph'), true);
});

test('work-space coords scale up to full resolution', () => {
  assert.deepEqual(toFullSpace({ x: 10, y: 20, w: 30, h: 40 }, 2.5), {
    x: 25,
    y: 50,
    w: 75,
    h: 100,
  });
});

test('box ids survive a context without crypto.randomUUID', () => {
  // Plain http on a LAN address, which is how the app is opened on a phone for
  // testing. randomUUID is secure-context only and simply isn't there.
  const real = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    const a = newBox({ x: 0, y: 0, w: 10, h: 10 });
    const b = newBox({ x: 0, y: 0, w: 10, h: 10 });
    assert.ok(a.id.length > 0);
    assert.notEqual(a.id, b.id);
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
  }
});
