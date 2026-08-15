'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DropZone from '@/components/DropZone';
import DocumentCanvas from '@/components/DocumentCanvas';
import BoxOverlay from '@/components/BoxOverlay';
import DetectionPanel from '@/components/DetectionPanel';
import WatermarkControls from '@/components/WatermarkControls';
import ExportBar from '@/components/ExportBar';
import StepIndicator from '@/components/StepIndicator';
import PageNav from '@/components/PageNav';
import PrivacyBadge from '@/components/PrivacyBadge';
import ZoomControl from '@/components/ZoomControl';
import Wordmark from '@/components/Wordmark';
import { STEPS, furthestStep } from '@/lib/steps';
import { openDocument, type Doc } from '@/lib/document';
import { NormaliseError, type NormalisedImage } from '@/lib/image/normalise';
import { renderDocument } from '@/lib/redact/apply';
import { prewarm, readWords, type OcrStage } from '@/lib/ocr/worker';
import { detectAll } from '@/lib/detect';
import { detectFaces } from '@/lib/detect/face';
import { detectCodes } from '@/lib/detect/qr';
import { stampText } from '@/lib/redact/watermark';
import { PRESETS, applyPreset, revealedIn, type Preset } from '@/lib/purpose';
import { spoken, type Box } from '@/lib/boxes';

export default function Page() {
  const [step, setStep] = useState(0);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<NormalisedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Boxes belong to a page, not to the document — page 3's address block is not
  // page 1's.
  const [boxesByPage, setBoxesByPage] = useState<Record<number, Box[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(true);
  const [zoom, setZoom] = useState(1);

  // On by default with a preset filled in: users who want a stamp get one
  // without thinking, and turning it off is one click (PRD §12).
  const [stampOn, setStampOn] = useState(true);
  const [purpose, setPurpose] = useState<string>(PRESETS[0].name);
  // The text is pre-filled, but the *policy* only applies once the user picks a
  // chip. A preset un-hides fields, and nothing may un-hide a field on its own.
  const [preset, setPreset] = useState<Preset | null>(null);
  // Pages are detected lazily, so a preset chosen on page 1 has to still be
  // there when page 3 is read. A ref, because it must not re-trigger OCR.
  const activePreset = useRef<Preset | null>(null);
  activePreset.current = preset;

  const [ocrStage, setOcrStage] = useState<OcrStage>('idle');
  // Pages the user has confirmed they checked by hand, after detection found
  // nothing. Per page, because page 2 finding nothing says nothing about page 1.
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Load the engine before a file is picked, so the wait isn't mid-flow.
  useEffect(prewarm, []);

  const current = STEPS[step];
  const limit = furthestStep(!!doc);
  const stamp = stampOn ? stampText(purpose) : '';
  const boxes = useMemo(() => boxesByPage[pageIndex] ?? [], [boxesByPage, pageIndex]);

  const setBoxes = useCallback(
    (update: (boxes: Box[]) => Box[]) =>
      setBoxesByPage((all) => ({ ...all, [pageIndex]: update(all[pageIndex] ?? []) })),
    [pageIndex],
  );

  // Pages are rasterised on demand, so opening one is async even for images.
  useEffect(() => {
    if (!doc) return;
    let live = true;
    setPage(null);
    doc
      .page(pageIndex)
      .then((p) => live && setPage(p))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't open that page."));
    return () => {
      live = false;
    };
  }, [doc, pageIndex]);

  // Read each page as it opens, then turn the words into boxes.
  useEffect(() => {
    if (!page) return;
    let live = true;
    setOcrStage('reading');
    // Faces and text are found by two engines that share nothing, so they run
    // together. Either can fail on its own without taking the other's findings
    // down with it — detectFaces already resolves to [] rather than throwing.
    const reading = readWords(page.work).catch(() => {
      if (live) setOcrStage('unavailable');
      return [];
    });

    Promise.all([reading, detectFaces(page.work), detectCodes(page.work)])
      .then(([found, faces, codes]) => {
        if (!live) return;
        setOcrStage((stage) => (stage === 'unavailable' ? stage : 'ready'));
        const candidates = detectAll(found, page.work.width, page.work.height, [...faces, ...codes]);
        // A preset chosen earlier applies to pages opened later, or page 3 would
        // silently keep hiding fields the user already said this recipient needs.
        const detected = activePreset.current
          ? applyPreset(candidates, activePreset.current)
          : candidates;
        // Only seed a page that has none. Re-running detection over a page the
        // user has already edited would resurrect boxes they deleted.
        setBoxesByPage((all) =>
          all[pageIndex]?.length || !detected.length ? all : { ...all, [pageIndex]: detected },
        );
      });
    return () => {
      live = false;
    };
    // `pageIndex` is a dependency so a fast page flip can never drop one page's
    // detections onto another.
  }, [page, pageIndex]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const opened = await openDocument(file);
      setDoc(opened);
      setPageIndex(0);
      setBoxesByPage({});
      setSelected(null);
      setDismissed(new Set());
      setDrawing(true);
      setStep(1);
    } catch (e) {
      setDoc(null);
      setError(
        e instanceof NormaliseError ? e.message : "Couldn't read this file. Try a clearer photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  /** A preset sets the stamp text and the field policy, across every page. */
  function choosePreset(chosen: Preset) {
    setPurpose(chosen.name);
    setPreset(chosen);
    setBoxesByPage((all) =>
      Object.fromEntries(
        Object.entries(all).map(([i, list]) => [i, applyPreset(list, chosen)]),
      ),
    );
  }

  function reset() {
    setDoc(null);
    setPage(null);
    setPageIndex(0);
    setBoxesByPage({});
    setSelected(null);
    setDismissed(new Set());
    setPreset(null);
    setPurpose(PRESETS[0].name);
    setError(null);
    setStep(0);
  }

  // Live preview of the stamp as it's typed (DESIGN.md §5). Scoped to this step
  // on purpose — recomputing it while boxes are being dragged would redraw the
  // whole canvas on every pointer move.
  const onPurpose = current.key === 'purpose';
  const stamped = useMemo(
    () => (page && onPurpose ? renderDocument(page.work, boxes, 1, stamp) : null),
    [page, boxes, stamp, onPurpose],
  );

  // Detection is a starting point, never a guarantee. The wording says what was
  // found and leaves the judgement with the reader (PRD §7).
  const summary = useMemo(() => {
    const found = boxes.filter((b) => b.source !== 'manual');
    if (!found.length) return 'Nothing found automatically. Mark anything sensitive yourself.';
    // Name what was found rather than counting it — "Found 3 fields" tells the
    // reader nothing about whether their address is one of them.
    const labels = [...new Set(found.map((b) => spoken(b.label)))];
    const list =
      labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
    const unsure = found.filter((b) => b.source === 'suggested').length;
    const parts = [`Found ${list}.`];
    if (unsure)
      parts.push(
        `${unsure} of ${found.length > unsure ? 'these' : 'them'} ${unsure > 1 ? 'are guesses' : 'is a guess'} — check the dashed ${unsure > 1 ? 'boxes' : 'box'}.`,
      );
    parts.push('Check everything else yourself.');
    return parts.join(' ');
  }, [boxes]);

  const markedPages = useMemo(
    () =>
      new Set(
        Object.entries(boxesByPage)
          .filter(([, list]) => list.length > 0)
          .map(([i]) => Number(i)),
      ),
    [boxesByPage],
  );

  const loading = doc && !page && !error;

  // Nothing found and nothing drawn — the user has to say they have looked
  // before the wizard will move on. Drawing a box counts as looking, so the
  // warning clears itself the moment they mark anything.
  const blocked =
    current.key === 'review' &&
    ocrStage === 'ready' &&
    boxes.length === 0 &&
    !dismissed.has(pageIndex);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-7 px-5 py-8">
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <div className="flex items-center gap-4">
          <PrivacyBadge />
          {doc && (
            <button
              type="button"
              onClick={reset}
              className="text-ink-soft text-[15px] whitespace-nowrap underline underline-offset-4"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <StepIndicator
        steps={STEPS}
        current={step}
        onGo={(i) => i <= limit && !(blocked && i > step) && setStep(i)}
      />

      {/* Keyed on the step so the cross-fade runs on every change (DESIGN.md §8). */}
      <div key={current.key} className="step-enter flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[28px] leading-[34px]">{current.title}</h1>
          <p className="text-ink-soft text-[15px]">{current.subtitle}</p>
        </div>

        {current.key === 'add' &&
          (busy ? (
            <p className="text-ink-soft text-center">Reading the document…</p>
          ) : (
            <DropZone onFile={handleFile} error={error} />
          ))}

        {current.key !== 'add' && loading && (
          <p className="text-ink-soft">Reading page {pageIndex + 1}…</p>
        )}

        {current.key === 'review' && page && doc && (
          <>
            {doc.pageCount > 1 && (
              <PageNav
                pageIndex={pageIndex}
                pageCount={doc.pageCount}
                onGo={(i) => {
                  setSelected(null);
                  setPageIndex(i);
                }}
                markedPages={markedPages}
              />
            )}
            {ocrStage === 'reading' && (
              <p className="text-ink-soft text-[15px]">Looking for sensitive fields…</p>
            )}
            {ocrStage === 'unavailable' && (
              <p className="text-ink-soft text-[15px]">
                Automatic detection isn&apos;t available. You can still mark and hide anything by
                hand.
              </p>
            )}
            {ocrStage === 'ready' && boxes.length > 0 && (
              <p className="text-ink-soft text-[15px]">{summary}</p>
            )}

            {/* The one place the interface is deliberately obstructive. Silence
                here would let someone export an unredacted Aadhaar believing it
                was safe, which is the worst failure this product has
                (PRD §12, DESIGN.md §7). */}
            {blocked && (
              <div
                role="alert"
                className="border-alert bg-alert/8 flex flex-col gap-3 rounded-lg border-2 p-4"
              >
                <p className="text-alert text-[17px] font-medium">
                  No sensitive fields found on this page.
                </p>
                <p className="text-ink text-[15px]">
                  That doesn&apos;t mean there are none. Check this document yourself and box
                  anything you don&apos;t want to share before saving.
                </p>
                <button
                  type="button"
                  onClick={() => setDismissed((all) => new Set(all).add(pageIndex))}
                  className="border-alert text-alert self-start rounded border px-3 py-2 text-[15px] font-medium"
                >
                  I&apos;ve checked this page
                </button>
              </div>
            )}

            <ZoomControl zoom={zoom} setZoom={setZoom} />

            <div className="flex flex-col items-start gap-5 md:flex-row">
              <DocumentCanvas canvas={page.work} zoom={zoom}>
                <BoxOverlay
                  boxes={boxes}
                  setBoxes={setBoxes}
                  selected={selected}
                  setSelected={setSelected}
                  width={page.work.width}
                  height={page.work.height}
                  drawing={drawing}
                />
              </DocumentCanvas>
              <DetectionPanel
                boxes={boxes}
                setBoxes={setBoxes}
                selected={selected}
                setSelected={setSelected}
                drawing={drawing}
                setDrawing={setDrawing}
              />
            </div>
          </>
        )}

        {current.key === 'purpose' && stamped && (
          <div className="flex flex-col items-start gap-5 md:flex-row">
            <DocumentCanvas canvas={stamped} />
            <WatermarkControls
              on={stampOn}
              setOn={setStampOn}
              purpose={purpose}
              setPurpose={setPurpose}
              onPreset={choosePreset}
              revealed={preset ? { preset, labels: revealedIn(boxes, preset) } : null}
            />
          </div>
        )}

        {current.key === 'save' && page && doc && (
          <ExportBar
            doc={doc}
            page={page}
            pageIndex={pageIndex}
            boxesByPage={boxesByPage}
            stamp={stamp}
          />
        )}
      </div>

      {step > 0 && (
        <div className="border-rule bg-paper sticky bottom-0 z-10 flex items-center gap-3 border-t py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:py-0 md:pt-2">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="border-rule min-h-11 rounded border px-4 py-2 text-[15px]"
          >
            Back
          </button>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={blocked}
              className="bg-action hover:bg-action-hover min-h-11 flex-1 rounded px-4 py-2 text-[15px] font-medium text-white disabled:opacity-40 md:flex-none"
            >
              Continue
            </button>
          )}
        </div>
      )}
    </main>
  );
}
