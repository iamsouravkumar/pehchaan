/**
 * PDF export, written by hand.
 *
 * We need exactly one thing from a PDF library: wrap one JPEG per page. That is
 * one of the simplest structures the format has, and a general-purpose library
 * costs several hundred kilobytes of features we never call, including, in
 * jsPDF's case, a hardcoded CDN URL sitting in the bundle of a product whose
 * whole claim is that there is nowhere for your document to go. Dead code or
 * not, it is the wrong string to have in this bundle.
 *
 * Each page is embedded as the redacted raster. The original PDF's text layer
 * is deliberately not preserved; preserving it would preserve the very text we
 * just redacted, which is exactly how real documents have leaked. Losing text
 * selectability is the correct trade (TRD §6).
 */

import { download, redactedName, toBlob } from './toImage.ts';

/** A4's long edge in points. Keeps pages a sane physical size to print. */
const LONG_EDGE_PT = 842;

export type PdfPage = {
  jpeg: Uint8Array;
  /** Pixel dimensions of the embedded image. */
  width: number;
  height: number;
};

/**
 * Assemble the file. Offsets in the cross-reference table are byte counts, not
 * string lengths (JPEG data is binary and a UTF-16 length would be wrong), so
 * everything is accumulated as encoded chunks.
 */
export function buildPdf(pages: PdfPage[]): Blob {
  if (pages.length === 0) throw new Error('There are no pages to save.');

  const encoder = new TextEncoder();
  const chunks: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: string | Uint8Array) => {
    length += typeof data === 'string' ? encoder.encode(data).length : data.length;
    chunks.push(data);
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };
  const endObject = () => push('endobj\n');

  push('%PDF-1.4\n');
  // A binary comment tells every reader to treat this as a binary file.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // 1 = catalog, 2 = page tree, then three objects per page.
  const pageId = (i: number) => 3 + i * 3;
  const kids = pages.map((_, i) => `${pageId(i)} 0 R`).join(' ');

  startObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  startObject(2);
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\n`);
  endObject();

  pages.forEach((page, i) => {
    const scale = LONG_EDGE_PT / Math.max(page.width, page.height);
    const w = (page.width * scale).toFixed(2);
    const h = (page.height * scale).toFixed(2);
    const [id, contentId, imageId] = [pageId(i), pageId(i) + 1, pageId(i) + 2];

    startObject(id);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`,
    );
    endObject();

    // Scale the unit image square up to fill the page.
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
    startObject(contentId);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\n`);
    endObject();

    startObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    push('\nendstream\n');
    endObject();
  });

  const count = 2 + pages.length * 3;
  const xrefOffset = length;
  push(`xref\n0 ${count + 1}\n`);
  // Every entry is exactly 20 bytes wide; readers index into this by arithmetic.
  push('0000000000 65535 f \n');
  for (let id = 1; id <= count; id++) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function savePdf(canvases: HTMLCanvasElement[], sourceName: string): Promise<string> {
  const pages: PdfPage[] = [];
  for (const canvas of canvases) {
    const blob = await toBlob(canvas, 'image/jpeg');
    pages.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    });
  }
  const filename = redactedName(sourceName, 'pdf');
  download(buildPdf(pages), filename);
  return filename;
}
