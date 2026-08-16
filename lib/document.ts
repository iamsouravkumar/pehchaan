/**
 * One document in flight, image or PDF, behind one shape.
 *
 * Pages are rasterised on demand and cached. A forty-page PDF must not render
 * forty canvases because the user opened page one (TRD §8).
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  NormaliseError,
  blankCanvas,
  checkFile,
  isPdf,
  normalise,
  normaliseCanvas,
  type NormalisedImage,
} from './image/normalise.ts';

/** PDFs carry no pixel resolution of their own, so we pick one. */
const PDF_TARGET_EDGE = 2400;

export type Doc = {
  name: string;
  type: string;
  pageCount: number;
  page(index: number): Promise<NormalisedImage>;
};

export async function openDocument(file: File): Promise<Doc> {
  const reason = checkFile(file);
  if (reason) throw new NormaliseError(reason);
  return isPdf(file.type) ? openPdf(file) : openImage(file);
}

function openImage(file: File): Doc {
  let cached: Promise<NormalisedImage> | null = null;
  return {
    name: file.name,
    type: file.type,
    pageCount: 1,
    page: () => (cached ??= normalise(file)),
  };
}

async function openPdf(file: File): Promise<Doc> {
  // Imported at call time, not module scope: it keeps a megabyte of PDF engine
  // out of the initial bundle, and it never runs during the static export.
  const pdfjs = await import('pdfjs-dist');

  // Without this, PDF.js fetches its worker from a CDN. It still works, so the
  // failure is silent, and it would break the whole privacy claim. Vendored by
  // scripts/copy-assets.mjs.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'PasswordException') {
      throw new NormaliseError("This PDF is password-protected. Pehchaan can't open it.");
    }
    throw new NormaliseError("Couldn't read this PDF. It may be damaged.");
  }

  const cache = new Map<number, Promise<NormalisedImage>>();
  return {
    name: file.name,
    type: file.type,
    pageCount: pdf.numPages,
    page(index) {
      let render = cache.get(index);
      if (!render) {
        render = renderPage(pdf, index, file.name, file.type);
        cache.set(index, render);
      }
      return render;
    },
  };
}

async function renderPage(
  pdf: PDFDocumentProxy,
  index: number,
  name: string,
  type: string,
): Promise<NormalisedImage> {
  const page = await pdf.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: PDF_TARGET_EDGE / Math.max(base.width, base.height),
  });

  const canvas = blankCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new NormaliseError("This browser can't render the document.");

  // Pages can be transparent; the stage is always white (DESIGN.md §3).
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  return normaliseCanvas(canvas, name, type);
}
