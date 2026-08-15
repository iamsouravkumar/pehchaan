'use client';

/** Only rendered for multi-page documents. Boxes are kept per page. */
export default function PageNav({
  pageIndex,
  pageCount,
  onGo,
  markedPages,
}: {
  pageIndex: number;
  pageCount: number;
  onGo: (index: number) => void;
  /** Pages that already have at least one box, so nothing gets forgotten. */
  markedPages: Set<number>;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onGo(pageIndex - 1)}
        disabled={pageIndex === 0}
        className="border-rule rounded border px-2.5 py-1 text-[15px] disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-mono text-xs">
        Page {pageIndex + 1} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onGo(pageIndex + 1)}
        disabled={pageIndex === pageCount - 1}
        className="border-rule rounded border px-2.5 py-1 text-[15px] disabled:opacity-40"
      >
        Next
      </button>
      <span className="text-ink-soft font-mono text-xs">
        {markedPages.size} of {pageCount} marked
      </span>
    </div>
  );
}
