/**
 * Verhoeff checksum — the last digit of an Aadhaar number.
 *
 * A bare 12-digit regex matches enrolment numbers, VID fragments, two phone
 * numbers sitting next to each other, and plain OCR noise. The checksum removes
 * nearly all of it (TRD §4.2).
 *
 * It is a dihedral-group checksum, not a modulus: the tables below are the
 * group's multiplication table `D`, the permutation `P` applied per position,
 * and the inverse table used to check the result.
 */

// prettier-ignore
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// prettier-ignore
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when the digits carry a valid trailing Verhoeff check digit. */
export function verhoeff(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let check = 0;
  // Right to left, so the check digit is position 0.
  [...digits].reverse().forEach((char, i) => {
    check = D[check][P[i % 8][Number(char)]];
  });
  return check === 0;
}

/**
 * Aadhaar numbers never begin with 0 or 1 — the first digit is reserved so the
 * number can't collide with a phone number. Cheaper than the checksum and it
 * rejects a whole class of false positives before we get there.
 */
export function looksLikeAadhaar(digits: string): boolean {
  return /^[2-9]\d{11}$/.test(digits);
}
