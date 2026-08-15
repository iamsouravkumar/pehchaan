import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDetectCodes, detectCodes, padCode } from './qr.ts';
import { allowsBlur } from '../boxes.ts';

/** A canvas stand-in — nothing here reads pixels, only dimensions. */
const canvas = (width = 1000, height = 800) => ({ width, height }) as HTMLCanvasElement;

function withDetector(result: unknown, fn: () => Promise<void>) {
  const globals = globalThis as Record<string, unknown>;
  const saved = globals.BarcodeDetector;
  globals.BarcodeDetector = class {
    async detect() {
      if (result instanceof Error) throw result;
      return result;
    }
  };
  return fn().finally(() => {
    if (saved === undefined) delete globals.BarcodeDetector;
    else globals.BarcodeDetector = saved;
  });
}

test('a QR code is always a solid block, never blur', () => {
  // Error correction means a partially destroyed symbol still decodes.
  assert.equal(allowsBlur('QR code'), false);
});

test('pads past the symbol, keeping the box on the page', () => {
  const box = padCode({ x: 100, y: 100, w: 200, h: 200 }, 1000, 800);
  assert.ok(box.x < 100 && box.y < 100);
  assert.ok(box.w > 200 && box.h > 200);

  const corner = padCode({ x: 0, y: 0, w: 120, h: 120 }, 300, 300);
  assert.ok(corner.x >= 0 && corner.y >= 0);
  assert.ok(corner.x + corner.w <= 300 && corner.y + corner.h <= 300);
});

test('pads a non-square detection without distorting it', () => {
  // Both edges grow by the same amount, so a slightly-tall detection does not
  // come back as a wide one.
  const box = padCode({ x: 100, y: 100, w: 100, h: 200 }, 1000, 800);
  assert.equal(box.w - 100, box.h - 200);
});

test('detections become labelled QR boxes', async () => {
  await withDetector([{ boundingBox: { x: 700, y: 80, width: 180, height: 180 }, format: 'qr_code' }], async () => {
    const boxes = await detectCodes(canvas());
    assert.equal(boxes.length, 1);
    assert.equal(boxes[0].label, 'QR code');
    assert.equal(boxes[0].source, 'auto');
    assert.equal(boxes[0].style, 'block');
  });
});

test('a browser without BarcodeDetector returns nothing rather than throwing', async () => {
  const globals = globalThis as Record<string, unknown>;
  const saved = globals.BarcodeDetector;
  delete globals.BarcodeDetector;
  assert.equal(canDetectCodes(), false);
  assert.deepEqual(await detectCodes(canvas()), []);
  if (saved !== undefined) globals.BarcodeDetector = saved;
});

test('a detector that throws degrades to manual rather than breaking review', async () => {
  await withDetector(new Error('unsupported format'), async () => {
    assert.deepEqual(await detectCodes(canvas()), []);
  });
});
