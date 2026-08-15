'use client';

import { useEffect, useMemo, useState } from 'react';
import DocumentCanvas from '@/components/DocumentCanvas';
import { renderDocument } from '@/lib/redact/apply';
import { formatFor, saveImage } from '@/lib/export/toImage';
import { savePdf } from '@/lib/export/toPdf';
import { isPdf, type NormalisedImage } from '@/lib/image/normalise';
import type { Doc } from '@/lib/document';
import type { Box } from '@/lib/boxes';
import { NO_TRAFFIC, watchTraffic, type Traffic } from '@/lib/privacy';

export default function ExportBar({
  doc,
  page,
  pageIndex,
  boxesByPage,
  stamp,
}: {
  doc: Doc;
  page: NormalisedImage;
  pageIndex: number;
  boxesByPage: Record<number, Box[]>;
  stamp: string;
}) {
  const multiPage = doc.pageCount > 1;
  // A multi-page document has no single-image form to save as.
  const [asPdf, setAsPdf] = useState(multiPage || isPdf(doc.type));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [traffic, setTraffic] = useState<Traffic>(NO_TRAFFIC);

  useEffect(() => watchTraffic(setTraffic), []);

  const boxes = boxesByPage[pageIndex] ?? [];

  // Rendered at working resolution. The saved file is the same operation on the
  // full-resolution page — every measurement in the pipeline is a ratio, so
  // what's on screen here is what lands in the file.
  const preview = useMemo(
    () => renderDocument(page.work, boxes, 1, stamp),
    [page, boxes, stamp],
  );

  const hidden = Object.values(boxesByPage)
    .flat()
    .filter((b) => b.enabled).length;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (asPdf) {
        const rendered: HTMLCanvasElement[] = [];
        for (let i = 0; i < doc.pageCount; i++) {
          const p = await doc.page(i);
          rendered.push(renderDocument(p.full, boxesByPage[i] ?? [], p.scaleToFull, stamp));
        }
        setSaved(await savePdf(rendered, doc.name));
      } else {
        const out = renderDocument(page.full, boxes, page.scaleToFull, stamp);
        setSaved(await saveImage(out, doc.name, doc.type));
      }
    } catch (e) {
      setSaved(null);
      setError(e instanceof Error ? e.message : "Couldn't save the redacted copy.");
    } finally {
      setSaving(false);
    }
  }

  const extension = asPdf ? 'pdf' : formatFor(doc.type).extension;

  return (
    <div className="flex flex-col gap-4">
      <DocumentCanvas canvas={preview} />
      {multiPage && (
        <p className="text-ink-soft font-mono text-xs">
          Showing page {pageIndex + 1}. All {doc.pageCount} pages are saved.
        </p>
      )}

      {hidden === 0 && (
        <p role="alert" className="text-alert text-[15px]">
          Nothing is hidden. Saving now gives you a copy of the original.
        </p>
      )}

      <fieldset className="flex items-center gap-4">
        <legend className="sr-only">File format</legend>
        {(
          [
            ['Image', false],
            ['PDF', true],
          ] as const
        ).map(([label, value]) => (
          <label
            key={label}
            className={`text-[15px] ${multiPage && !value ? 'text-ink-soft opacity-40' : ''}`}
          >
            <input
              type="radio"
              name="format"
              checked={asPdf === value}
              disabled={multiPage && !value}
              onChange={() => setAsPdf(value)}
              className="mr-1.5"
            />
            {label}
          </label>
        ))}
        {multiPage && (
          <span className="text-ink-soft text-[13px]">
            A {doc.pageCount}-page document saves as a PDF.
          </span>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-stamp rounded px-4 py-2 text-[15px] font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save redacted copy'}
        </button>
        <p className="text-ink-soft font-mono text-xs">
          {hidden} {hidden === 1 ? 'area' : 'areas'} hidden · .{extension}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-alert text-[15px]">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-safe text-[15px]">
          Saved as <span className="font-mono text-xs">{saved}</span>. The hidden parts are gone
          from the pixels, not covered by a layer that can be removed.
        </p>
      )}

      {/* The closing line (DESIGN.md §5). It says the same thing as the badge in
          the corner, at the moment the user is deciding whether to trust it. */}
      <p className="border-rule text-ink-soft border-t pt-4 font-mono text-xs">
        Requests sent off this device since you opened this page: {traffic.offDevice}
        {traffic.offDevice > 0 && ` (${traffic.hosts.join(', ')})`}
      </p>
    </div>
  );
}
