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

/**
 * Labels whose *value* identifies a person on an otherwise ordinary document.
 *
 * Marksheets are why this list is long. There is no marksheet format: every
 * board, university and school prints its own, and the number that identifies
 * the student is called a roll number on one, an enrolment number on the next,
 * a seat, index, PRN or hall ticket on the one after. The label is the only
 * thing they share, so the vocabulary has to cover the ways it gets written.
 */
const NUMBER_LABELS: Record<string, string> = {
  rollno: 'Roll number',
  roll: 'Roll number',
  rollnumber: 'Roll number',
  regno: 'Roll number',
  regdno: 'Roll number',
  regd: 'Roll number',
  registrationno: 'Roll number',
  registration: 'Roll number',
  enrolment: 'Roll number',
  enrollment: 'Roll number',
  enrolmentno: 'Roll number',
  enrollmentno: 'Roll number',
  seat: 'Roll number',
  seatno: 'Roll number',
  index: 'Roll number',
  indexno: 'Roll number',
  prn: 'Roll number',
  hallticket: 'Roll number',
  admission: 'Roll number',
  admissionno: 'Roll number',
  grno: 'Roll number',
  studentid: 'Roll number',
  certificateno: 'Roll number',
  serialno: 'Roll number',
  ac: 'Account number',
  acno: 'Account number',
  accountno: 'Account number',
  account: 'Account number',
  mobile: 'Phone number',
  phone: 'Phone number',
  mob: 'Phone number',
};

/**
 * Labels whose value is a person's name rather than a number.
 *
 * Only the ones that name a *person*. A marksheet is full of "name of" phrases
 * that name an institution instead, and boxing the school is noise the user has
 * to clear every time.
 */
const NAME_LABELS = [
  'name',
  'candidate',
  'candidates',
  'student',
  'students',
  'father',
  // The possessive forms, because anchorOf drops the apostrophe and "Father's"
  // arrives here as "fathers". They are also what stops the label column of a
  // two-column layout from being read as the value of the label above it.
  'fathers',
  'mother',
  'mothers',
  'guardian',
  'guardians',
];

/** After one of these, the value is an organisation, not a person. */
const NOT_A_PERSON = [
  'school',
  'examination',
  'exam',
  'board',
  'college',
  'institute',
  'institution',
  'university',
  'course',
  'subject',
  'centre',
  'center',
];

/** Words between a label and its value that carry no meaning of their own. */
const FILLER = [
  'of',
  'the',
  'no',
  'number',
  'name',
  'names',
  'mr',
  'mrs',
  'ms',
  'shri',
  'smt',
  'sri',
  'kumari',
];

export function detectDates(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];
  const box = (members: Word[]) =>
    found.push(newBox(clampRect(pad(union(members)), width, height), 'Date of birth', 'auto'));

  for (const line of lines(words)) {
    line.forEach((word, i) => {
      // Keep the separators; they are part of a date, unlike inside a number.
      const text = word.text.replace(/\s/g, '');
      if (DATE.test(text)) return box([word]);

      // A bare year is only a birth year when something says so; four digits
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
 * ponytail: takes whole lines, so a two-column layout will over-cover; the
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

/** A word that could be the number a label was pointing at. */
function looksLikeReference(word: Word): boolean {
  const text = clean(word.text);
  // Four digits *somewhere* rather than a pure number, because roll and
  // registration numbers mix letters into the number itself ("2019CS4471").
  if ((text.match(/\d/g) ?? []).length < 4) return false;
  // A bare year is not a roll number, and marksheets are covered in years.
  return !YEAR.test(text);
}

/** A word that could be part of a person's name. */
function looksLikeNamePart(word: Word): boolean {
  const text = clean(word.text).replace(/[^A-Za-z]/g, '');
  return text.length >= 2 && text.length === clean(word.text).replace(/[.:,]/g, '').length;
}

/**
 * The words a label points at: the rest of its own line, then the line below.
 *
 * The line below matters because half of all marksheets are laid out as a
 * table, with "Roll No." in a header cell and the number in the cell under it.
 * A same-line-only search finds nothing on those, which is exactly what
 * happened on the first real marksheet tested here. Words below only count when
 * they sit under the label horizontally, or every value on the row would match.
 */
function valuesFor(rows: Word[][], row: number, index: number): Word[][] {
  const label = rows[row][index];
  const rest = rows[row].slice(index + 1);

  // The line below is only consulted when this line holds nothing but the
  // label: a heading in its own cell. If the label is followed by anything of
  // substance, that is its value, and reaching downwards as well would box the
  // label sitting in the next row of the same column.
  const spoken = rest.some(
    (w) => /\d/.test(w.text) || (anchorOf(w.text) && !FILLER.includes(anchorOf(w.text))),
  );
  if (spoken) return [rest];

  const under = (w: Word) =>
    w.x + w.w > label.x - label.h && w.x < label.x + Math.max(label.w, label.h) * 3;
  return [rest, ...rows.slice(row + 1, row + 3).map((r) => r.filter(under))];
}

/** Skip the filler between a label and the thing it labels. */
function skipFiller(words: Word[]): Word[] {
  let i = 0;
  while (i < words.length && (FILLER.includes(anchorOf(words[i].text)) || !anchorOf(words[i].text))) {
    i++;
  }
  return words.slice(i);
}

/** `Roll No 12345`: the label locates it, the number is what gets hidden. */
export function detectLabelledNumbers(words: Word[], width: number, height: number): Box[] {
  const rows = lines(words);
  const found: Box[] = [];

  rows.forEach((line, row) => {
    line.forEach((word, i) => {
      const label = NUMBER_LABELS[anchorOf(word.text)];
      if (!label) return;

      for (const candidates of valuesFor(rows, row, i)) {
        // Allow a few words of noise between: "Roll No .", "Account Number :".
        const value = candidates.slice(0, 4).find(looksLikeReference);
        if (!value) continue;
        found.push(newBox(clampRect(pad(union([value])), width, height), label, 'suggested'));
        return;
      }
    });
  });
  return found;
}

/**
 * `Name of Candidate: RAHUL SHARMA`, and the father's and mother's names beside
 * it. A name is not a format, so this is anchored entirely on the label: no
 * label, no box, which is the only way to keep it from boxing the whole page.
 */
export function detectNames(words: Word[], width: number, height: number): Box[] {
  const rows = lines(words);
  const found: Box[] = [];
  // "Father's Name" carries two anchors pointing at one name. Boxing it twice
  // is one finding the user has to dismiss twice.
  const claimed = new Set<Word>();

  rows.forEach((line, row) => {
    line.forEach((word, i) => {
      if (!NAME_LABELS.includes(anchorOf(word.text))) return;
      // "Name of School" names an institution. Only a person is hidden here.
      if (line.slice(i + 1, i + 4).some((w) => NOT_A_PERSON.includes(anchorOf(w.text)))) return;

      for (const candidates of valuesFor(rows, row, i)) {
        const rest = skipFiller(candidates);
        // Consecutive word-shaped words, stopping at anything that isn't one:
        // a number, a colon on its own, or the next label along the row.
        const value: Word[] = [];
        for (const next of rest.slice(0, 5)) {
          if (!looksLikeNamePart(next)) break;
          if (NAME_LABELS.includes(anchorOf(next.text))) break;
          if (NUMBER_LABELS[anchorOf(next.text)]) break;
          value.push(next);
        }
        if (!value.length) continue;
        if (value.every((w) => claimed.has(w))) return;
        value.forEach((w) => claimed.add(w));
        found.push(newBox(clampRect(pad(union(value)), width, height), 'Name', 'suggested'));
        return;
      }
    });
  });
  return found;
}
