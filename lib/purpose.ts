/**
 * Purpose presets.
 *
 * Different recipients need different things. A hotel needs to know you are the
 * person on the booking; it does not need your date of birth, your address, or
 * your Aadhaar number. Most people don't know which fields a recipient is
 * entitled to, so the preset makes that call for them (PRD §7 P1).
 *
 * Presets are expressed as what stays *visible*, never as what gets hidden.
 * Written the other way, a field nobody thought of — a new detector's label, a
 * box the user drew themselves — would default to revealed. Written this way it
 * defaults to hidden, which is the only safe direction for this product to be
 * wrong in (PRD §8).
 */

import type { Box } from './boxes.ts';

export type Preset = {
  name: string;
  /** Labels this recipient legitimately needs to read. Everything else is masked. */
  reveal: readonly string[];
  /** Shown under the chips so the user can see the judgement being made for them. */
  note: string;
};

/**
 * The Aadhaar number is on no reveal list. UIDAI's own guidance is that a full
 * number should never be shared with a private party, and every recipient below
 * is a private party.
 */
export const PRESETS: readonly Preset[] = [
  {
    name: 'Bank KYC',
    reveal: ['Name', 'Photograph', 'Date of birth', 'Address', 'PAN'],
    note: 'A bank needs your PAN and address to open an account, but never the full Aadhaar number.',
  },
  {
    name: 'Rental agreement',
    reveal: ['Name', 'Photograph', 'Address'],
    note: 'A landlord verifies who you are and where you lived. Nothing else on the document concerns them.',
  },
  {
    name: 'College admission',
    reveal: ['Name', 'Photograph', 'Date of birth', 'Roll number'],
    note: 'An admissions office matches your name, age and roll number against their records.',
  },
  {
    name: 'SIM verification',
    reveal: ['Name', 'Photograph', 'Address'],
    note: 'An operator confirms name, face and address. The number itself is not part of that check.',
  },
  {
    name: 'Hotel check-in',
    reveal: ['Name', 'Photograph'],
    note: 'A front desk needs to see that the ID is yours. That is all it needs.',
  },
];

export function findPreset(name: string): Preset | undefined {
  return PRESETS.find((p) => p.name === name);
}

/**
 * Apply a preset's policy to a page's boxes. Toggling stays available on every
 * box afterwards — this sets a starting point, it does not take the decision
 * away.
 */
export function applyPreset(boxes: Box[], preset: Preset): Box[] {
  return boxes.map((box) => ({ ...box, enabled: !preset.reveal.includes(box.label) }));
}

/** What the preset will leave readable, for the line under the chips. */
export function revealedIn(boxes: Box[], preset: Preset): string[] {
  return [...new Set(boxes.map((b) => b.label))].filter((label) => preset.reveal.includes(label));
}
