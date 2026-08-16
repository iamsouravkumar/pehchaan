/**
 * The purpose stamp.
 *
 * The habit this replaces is real: people scrawl "for HDFC KYC only" across a
 * photocopy by hand, badly and inconsistently. This does the same job legibly,
 * and the date is generated rather than typed; a back-dated purpose stamp is a
 * forgery vector, so it is never editable (DESIGN.md §5).
 *
 * Every measurement here is a ratio of the canvas, never an absolute pixel
 * count, so the stamp lands identically on the working canvas and on the
 * full-resolution export. The preview has to be the truth.
 */

/* The preset list lives in lib/purpose.ts; a preset now decides which fields
   are masked as well as what the stamp reads, and that is not this file's job. */

/** Fixed format rather than the visitor's locale, so the stamp reads the same to everyone. */
export function stampDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
}

export function stampText(purpose: string, now: Date = new Date()): string {
  const trimmed = purpose.trim();
  const date = stampDate(now);
  if (!trimmed) return `Copy issued ${date}`;
  // Don't wrap a phrase the user already wrote as a full sentence.
  const phrase = /^for\b/i.test(trimmed) ? trimmed : `For ${trimmed} only`;
  return `${phrase} · ${date}`;
}

export type WatermarkLayout = {
  fontSize: number;
  lineGap: number;
  columnGap: number;
  angle: number;
};

export function watermarkLayout(width: number, height: number): WatermarkLayout {
  const fontSize = Math.max(11, Math.round(Math.min(width, height) * 0.042));
  return {
    fontSize,
    lineGap: fontSize * 4.2,
    columnGap: fontSize * 2.4,
    angle: -Math.PI / 9, // ~-20°, the angle a stamp lands at
  };
}

/** Mutates the canvas in place. Call it after redaction, never before. */
export function applyWatermark(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !text) return;

  const { fontSize, lineGap, columnGap, angle } = watermarkLayout(canvas.width, canvas.height);

  ctx.save();
  ctx.font = `500 ${fontSize}px ${monoFamily()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // A pale outline behind dark ink so the stamp stays legible over a white
  // margin and over a dark photograph alike, without ever obscuring either.
  ctx.lineWidth = Math.max(1, fontSize * 0.14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillStyle = 'rgba(10, 10, 11, 0.34)';
  ctx.lineJoin = 'round';

  const textWidth = ctx.measureText(text).width;
  const reach = Math.hypot(canvas.width, canvas.height) / 2;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  // Overshoot the rotated bounds by half a stamp in each direction. Text is
  // centre-aligned, so a row that stops exactly at the reach leaves the far
  // corners of the page bare.
  const edgeX = reach + textWidth / 2;
  const edgeY = reach + lineGap;
  for (let y = -edgeY; y <= edgeY; y += lineGap) {
    for (let x = -edgeX; x <= edgeX; x += textWidth + columnGap) {
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

/** The self-hosted mono face, so the stamp matches the interface's data voice. */
function monoFamily(): string {
  const value = getComputedStyle(document.body).getPropertyValue('--font-plex-mono').trim();
  return value ? `${value}, monospace` : 'monospace';
}
