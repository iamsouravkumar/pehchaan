/**
 * Everything that isn't a fixed-format ID number: dates of birth, address
 * blocks, and the roll / registration / account numbers that carry identity on
 * documents nobody thinks of as ID (TRD §4.2, §4.4).
 *
 * These are heuristics, not checksums. They run at the same confidence as a
 * suggestion would: a wrong box costs one click, a missed address costs the
 * user their home.
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Word } from '../ocr/worker.ts';
import { anchorOf, clean, digitsOf, lines, pad, union } from './words.ts';

/** DD/MM/YYYY and DD-MM-YYYY, printed with any separator OCR feels like. */
const DATE = /^(0?[1-9]|[12]\d|3[01])[/\-.](0?[1-9]|1[0-2])[/\-.](19|20)\d{2}$/;

/** Aadhaar prints only a year for people with no recorded birth date. */
const YEAR = /^(19|20)\d{2}$/;

const DATE_LABELS = ['dob', 'dateofbirth', 'birth', 'जन्मतिथि', 'जन्म', 'yearofbirth', 'year'];

/** Anchors that begin an address block. S/O, D/O and W/O start one implicitly. */
const ADDRESS_LABELS = ['address', 'पता', 's/o', 'd/o', 'w/o', 'c/o'];

/** A PIN code ends an Indian address, and is itself worth hiding. */
const PIN = /^\d{6}$/;

/** Labels whose *value* identifies a person on an otherwise ordinary document. */
const NUMBER_LABELS: Record<string, string> = {
  rollno: 'Roll number',
  roll: 'Roll number',
  regno: 'Roll number',
  registrationno: 'Roll number',
  registration: 'Roll number',
  enrolment: 'Roll number',
  enrollment: 'Roll number',
  enrolmentno: 'Roll number',
  ac: 'Account number',
  acno: 'Account number',
  accountno: 'Account number',
  account: 'Account number',
  mobile: 'Phone number',
  phone: 'Phone number',
  mob: 'Phone number',
};

export function detectDates(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];
  const box = (members: Word[]) =>
    found.push(
      newBox(clampRect(pad(union(members)), width, height), 'Date of birth', 'auto'),
    );

  for (const line of lines(words)) {
    line.forEach((word, i) => {
      // Keep the separators — they are part of a date, unlike inside a number.
      const text = word.text.replace(/\s/g, '');
      if (DATE.test(text)) return box([word]);

      // A bare year is only a birth year when something says so — four digits
      // on their own are a document year, an issue date, or a pin fragment.
      if (!YEAR.test(clean(text))) return;
      const labelled = line
        .slice(Math.max(0, i - 3), i)
        .some((w) => DATE_LABELS.includes(anchorOf(w.text)));
      if (labelled) box([word]);
    });
  }
  return found;
}

/**
 * An address block runs from its anchor to the PIN code that closes it.
 *
 * ponytail: takes whole lines, so a two-column layout will over-cover — the
 * block reaches the right-hand column too. Over-covering hides more than asked,
 * which is the safe direction to be wrong, and the user can resize the box.
 * Narrow it by x-extent if the demo documents need it.
 */
export function detectAddress(words: Word[], width: number, height: number): Box[] {
  const rows = lines(words);
  const found: Box[] = [];

  for (let i = 0; i < rows.length; i++) {
    const anchor = rows[i].findIndex((w) => ADDRESS_LABELS.includes(anchorOf(w.text)));
    if (anchor === -1) continue;

    const members: Word[] = [...rows[i].slice(anchor)];
    let end = i;
    // Six lines is a generous Indian address. Past that the anchor was almost
    // certainly something else and we would swallow the rest of the page.
    for (let j = i + 1; j < rows.length && j <= i + 6; j++) {
      members.push(...rows[j]);
      end = j;
      if (rows[j].some((w) => PIN.test(digitsOf(w.text) ?? ''))) break;
    }
    // A small ratio: pad() scales with the height it is handed, and this block
    // is many lines tall, so a line-sized ratio would swallow its neighbours.
    found.push(newBox(clampRect(pad(union(members), 0.03), width, height), 'Address', 'auto'));
    i = end; // one box per block, not one per line inside it
  }
  return found;
}

/** `Roll No 12345` — the label locates it, the number is what gets hidden. */
export function detectLabelledNumbers(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];

  for (const line of lines(words)) {
    line.forEach((word, i) => {
      const label = NUMBER_LABELS[anchorOf(word.text)];
      if (!label) return;
      // The value is the next number, allowing one word of noise between
      // ("Roll No.", "Account Number:"). Four digits *somewhere* in the word
      // rather than a pure number, because roll and registration numbers mix
      // letters into the number itself ("2019CS4471").
      const value = line.slice(i + 1, i + 3).find((w) => (w.text.match(/\d/g) ?? []).length >= 4);
      if (!value) return;
      found.push(
        newBox(clampRect(pad(union([value])), width, height), label, 'suggested'),
      );
    });
  }
  return found;
}
