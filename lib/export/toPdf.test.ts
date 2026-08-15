import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPdf, type PdfPage } from './toPdf.ts';

/** Not a real JPEG — buildPdf embeds bytes verbatim and never decodes them. */
const page = (bytes: number[], width = 1200, height = 1600): PdfPage => ({
  jpeg: new Uint8Array(bytes),
  width,
  height,
});

async function read(pages: PdfPage[]) {
  const bytes = new Uint8Array(await buildPdf(pages).arrayBuffer());
  // latin1 maps every byte to one character, so string indices are byte offsets.
  return { bytes, text: Buffer.from(bytes).toString('latin1') };
}

test('produces a file a reader will recognise', async () => {
  const { text } = await read([page([0xff, 0xd8, 0xff, 0xd9])]);
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
});

test('startxref points at the real byte offset of the xref table', async () => {
  // The one thing that silently breaks a hand-written PDF: offsets counted in
  // characters rather than bytes.
  const { text } = await read([page([0xff, 0xd8, 0x80, 0x90, 0xfe, 0xd9])]);
  const declared = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
  assert.equal(text.slice(declared, declared + 4), 'xref');
});

test('every object offset in the table lands on that object', async () => {
  const { text } = await read([page([0xff, 0xd8, 0xc0, 0xd9]), page([0xff, 0xd8, 0xef, 0xd9])]);
  // '\n' prefix so this doesn't match the 'xref' inside 'startxref'.
  const table = text.slice(text.lastIndexOf('\nxref\n'));
  const entries = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(entries.length, 8, 'catalog + page tree + three objects per page');
  entries.forEach((offset, i) => {
    assert.ok(text.startsWith(`${i + 1} 0 obj`, offset), `object ${i + 1} is not at ${offset}`);
  });
});

test('binary image data survives the round trip untouched', async () => {
  const jpeg = [0xff, 0xd8, 0x00, 0x0a, 0x1a, 0x80, 0xff, 0xd9];
  const { bytes, text } = await read([page(jpeg)]);
  const start = text.indexOf('stream\n', text.indexOf('/DCTDecode')) + 'stream\n'.length;
  assert.deepEqual([...bytes.slice(start, start + jpeg.length)], jpeg);
});

test('page size keeps the image aspect ratio', async () => {
  const { text } = await read([page([0xff, 0xd8, 0xd9], 1000, 500)]);
  const [, w, h] = text.match(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  assert.equal(Number(w), 842);
  assert.equal(Number(h), 421);
});

test('refuses to write an empty document', () => {
  assert.throws(() => buildPdf([]), /no pages/);
});
