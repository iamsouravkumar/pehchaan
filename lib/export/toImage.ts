/**
 * Image export.
 *
 * Encoding a canvas produces a bare image: no EXIF, no GPS, no XMP, no
 * thumbnail. Metadata stripping (TRD §7) is a property of this step, not a
 * separate feature.
 *
 * The download is an object URL and an anchor click. Nothing is uploaded and
 * there is nowhere to upload it to.
 */

/** Branding lives in the filename, never on the document itself (PRD §12). */
export function redactedName(sourceName: string, extension: string): string {
  const base = sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-');
  const stem = base.replace(/^-+|-+$/g, '').toLowerCase() || 'document';
  return `${stem}-redacted-pehchaan.${extension}`;
}

/** PNG stays lossless for screenshots and scans; photos encode far smaller as JPEG. */
export function formatFor(sourceType: string): { mime: string; extension: string } {
  return sourceType === 'image/png'
    ? { mime: 'image/png', extension: 'png' }
    : { mime: 'image/jpeg', extension: 'jpg' };
}

export function toBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the redacted copy."))),
      mime,
      0.92,
    );
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Encode and save. Returns the filename so the UI can confirm what was written. */
export async function saveImage(
  canvas: HTMLCanvasElement,
  sourceName: string,
  sourceType: string,
): Promise<string> {
  const { mime, extension } = formatFor(sourceType);
  const filename = redactedName(sourceName, extension);
  download(await toBlob(canvas, mime), filename);
  return filename;
}
