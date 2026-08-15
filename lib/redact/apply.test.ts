import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionsFor } from './apply.ts';
import type { Box } from '../boxes.ts';

const box = (over: Partial<Box>): Box => ({
  id: 'x',
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  label: 'Other',
  source: 'manual',
  style: 'block',
  enabled: true,
  ...over,
});

test('boxes drawn on the working canvas land on the full-resolution one', () => {
  assert.deepEqual(regionsFor([box({})], 2.5), [
    { x: 25, y: 50, w: 75, h: 100, style: 'block' },
  ]);
});

test('a switched-off box is left visible', () => {
  assert.deepEqual(regionsFor([box({ enabled: false })], 1), []);
});

test('mask style survives the scale-up', () => {
  const [region] = regionsFor([box({ style: 'blur', label: 'Photograph' })], 1);
  assert.equal(region.style, 'blur');
});
