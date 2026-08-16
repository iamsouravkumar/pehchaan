/**
 * Shared shaping of OCR output.
 *
 * Tesseract hands back a flat list of words with boxes. Every detector needs
 * the same two things first: words grouped back into reading order lines, and
 * a way to read digits out of text that a scanner got slightly wrong.
 */

import type { Word } from '../ocr/worker.ts';
import type { Rect } from '../boxes.ts';

/**
 * Characters OCR routinely returns in place of a digit (TRD §4.2).
 *
 * The list grew after a real Aadhaar came back undetected: on a low-resolution
 * card the engine reads 6 as G or b, 7 as T, 4 as A and 0 as D or U, and one
 * such character anywhere in a group threw the whole twelve-digit run away.
 * Adding a letter here is safe because `digitsOf` still demands the word hold a
 * real digit — "GOT" cannot become "607".
 */
const CONFUSIONS: Record<string, string> = {
  O: '0',
  o: '0',
  Q: '0',
  D: '0',
  U: '0',
  I: '1',
  l: '1',
  '|': '1',
  Z: '2',
  A: '4',
  S: '5',
  s: '5',
  G: '6',
  b: '6',
  T: '7',
  B: '8',
  g: '9',
  q: '9',
};

/** The same confusions read the other way, for positions that must be letters. */
const AS_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '7': 'T',
  '8': 'B',
};

/** Punctuation that shows up inside a printed number and means nothing. */
const SEPARATORS = /[\s\-–—.,:'"]/g;

/** Force a character towards a digit, or towards a letter (see PAN, TRD §4.2). */
export const asDigit = (c: string): string => CONFUSIONS[c] ?? c;
export const asLetter = (c: string): string => AS_LETTER[c] ?? c.toUpperCase();

/** A word with separators and surrounding punctuation stripped. */
export function clean(text: string): string {
  return text.replace(SEPARATORS, '');
}

/** Lowercased letters only, for matching a label whatever OCR did to its punctuation. */
export function anchorOf(text: string): string {
  return text.toLowerCase().replace(/[^a-zऀ-ॿ/]/g, '');
}

/**
 * The digits in a word, or null if it isn't a number at all. A word has to be
 * *entirely* digits once separators are dropped: "1234" is a candidate,
 * "No.1234x" is not, because a partial match would join fragments that were
 * never one number.
 */
export function digitsOf(text: string): string | null {
  const cleaned = text.replace(SEPARATORS, '');
  // At least one character has to already be a digit, or a word like "SOB"
  // substitutes its way into "508" and joins a run it has no business in.
  if (!/\d/.test(cleaned)) return null;
  const mapped = [...cleaned].map((c) => CONFUSIONS[c] ?? c).join('');
  return /^\d+$/.test(mapped) ? mapped : null;
}

/**
 * Group words into lines by vertical overlap rather than by a y threshold: a
 * photographed document is never perfectly level, and neighbouring words on a
 * tilted line differ in y by more than a fixed tolerance allows.
 */
export function lines(words: Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Word[][] = [];

  for (const word of sorted) {
    const line = out[out.length - 1];
    if (line && overlaps(line[line.length - 1], word)) line.push(word);
    else out.push([word]);
  }
  return out.map((line) => [...line].sort((a, b) => a.x - b.x));
}

/** Share more than half the height of the shorter word. */
function overlaps(a: Word, b: Word): boolean {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return bottom - top > Math.min(a.h, b.h) / 2;
}

/** Smallest rect covering every word given. */
export function union(words: Word[]): Rect {
  const x = Math.min(...words.map((w) => w.x));
  const y = Math.min(...words.map((w) => w.y));
  return {
    x,
    y,
    w: Math.max(...words.map((w) => w.x + w.w)) - x,
    h: Math.max(...words.map((w) => w.y + w.h)) - y,
  };
}

/**
 * Grow a detected rect. OCR boxes hug the ink, and a mask that hugs the ink
 * leaves the tops of digits and the edge stroke showing.
 */
export function pad(r: Rect, ratio = 0.18): Rect {
  const grow = r.h * ratio;
  return { x: r.x - grow, y: r.y - grow, w: r.w + grow * 2, h: r.h + grow * 2 };
}
