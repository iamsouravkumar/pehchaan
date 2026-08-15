import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampDate, stampText, watermarkLayout } from './watermark.ts';

const day = new Date('2026-08-14T10:30:00Z');

test('the date is generated, never typed', () => {
  assert.equal(stampDate(day), '14 Aug 2026');
});

test('a purpose becomes a stamp', () => {
  assert.equal(stampText('Bank KYC', day), 'For Bank KYC only · 14 Aug 2026');
});

test('a purpose already written as a phrase is not wrapped twice', () => {
  assert.equal(stampText('For HDFC KYC only', day), 'For HDFC KYC only · 14 Aug 2026');
  assert.equal(stampText('  Rental agreement  ', day), 'For Rental agreement only · 14 Aug 2026');
});

test('an empty purpose still dates the copy', () => {
  assert.equal(stampText('', day), 'Copy issued 14 Aug 2026');
  assert.equal(stampText('   ', day), 'Copy issued 14 Aug 2026');
});

test('the stamp scales with the canvas, so preview matches export', () => {
  const work = watermarkLayout(1000, 600);
  const full = watermarkLayout(3000, 1800);
  // Sizes are rounded to whole pixels for text rendering, so compare the
  // proportion of the canvas each one takes up rather than an exact multiple.
  assert.ok(Math.abs(work.fontSize / 600 - full.fontSize / 1800) < 0.001);
  assert.ok(Math.abs(work.lineGap / 600 - full.lineGap / 1800) < 0.005);
  assert.equal(full.angle, work.angle);
});

test('the stamp stays legible on a tiny canvas', () => {
  assert.ok(watermarkLayout(120, 80).fontSize >= 11);
});
