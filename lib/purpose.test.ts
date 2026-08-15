import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, applyPreset, findPreset, revealedIn } from './purpose.ts';
import { newBox, type Box } from './boxes.ts';

const box = (label: string): Box => newBox({ x: 0, y: 0, w: 10, h: 10 }, label, 'auto');

test('no preset ever reveals an Aadhaar number', () => {
  // UIDAI's own guidance: a full number is never shared with a private party,
  // and every recipient in this list is a private party.
  for (const preset of PRESETS) {
    assert.ok(!preset.reveal.includes('Aadhaar number'), preset.name);
  }
});

test('a preset reveals what the recipient needs and hides the rest', () => {
  const boxes = [box('Name'), box('Address'), box('Aadhaar number'), box('PAN')];
  const applied = applyPreset(boxes, findPreset('Rental agreement')!);
  const state = Object.fromEntries(applied.map((b) => [b.label, b.enabled]));
  assert.deepEqual(state, {
    Name: false,
    Address: false,
    'Aadhaar number': true,
    PAN: true,
  });
});

test('a label no preset mentions stays hidden', () => {
  // The safe direction. A new detector's label, or a box the user drew, must
  // not be revealed just because nobody listed it.
  const applied = applyPreset([box('Signature'), box('QR code')], PRESETS[0]);
  assert.ok(applied.every((b) => b.enabled));
});

test('applying a preset does not move or relabel anything', () => {
  const before = box('Name');
  const [after] = applyPreset([before], PRESETS[0]);
  assert.equal(after.id, before.id);
  assert.equal(after.label, before.label);
  assert.deepEqual(
    { x: after.x, y: after.y, w: after.w, h: after.h },
    { x: before.x, y: before.y, w: before.w, h: before.h },
  );
});

test('revealed labels are only those actually on the page', () => {
  const boxes = [box('Name'), box('Aadhaar number')];
  assert.deepEqual(revealedIn(boxes, findPreset('Hotel check-in')!), ['Name']);
});

test('every preset names itself and explains itself', () => {
  for (const preset of PRESETS) {
    assert.ok(preset.name.length > 0);
    assert.ok(preset.note.length > 20, `${preset.name} needs a reason the user can read`);
    assert.equal(findPreset(preset.name), preset);
  }
});
