'use client';

import { LABELS, allowsBlur, type Box } from '@/lib/boxes';

export default function DetectionPanel({
  boxes,
  setBoxes,
  selected,
  setSelected,
  drawing,
  setDrawing,
}: {
  boxes: Box[];
  setBoxes: (update: (boxes: Box[]) => Box[]) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  drawing: boolean;
  setDrawing: (on: boolean) => void;
}) {
  const patch = (id: string, fields: Partial<Box>) =>
    setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, ...fields } : b)));

  return (
    <aside className="border-rule bg-surface flex w-full flex-col gap-3 rounded-lg border p-4 md:w-72">
      <p className="text-ink-soft font-mono text-xs tracking-wide uppercase">
        Hidden areas · {boxes.length}
      </p>

      {/* Not a secondary tool behind an icon; boxing things yourself is an
          expected part of the flow, so it reads as primary (DESIGN.md §5). */}
      <button
        type="button"
        onClick={() => setDrawing(!drawing)}
        aria-pressed={drawing}
        className={`rounded px-3 py-2 text-[15px] font-medium ${
          drawing
            ? 'bg-action hover:bg-action-hover text-ink'
            : 'border-action text-action-ink border'
        }`}
      >
        {drawing ? 'Drawing: drag on the document' : '+ Draw a box'}
      </button>

      {boxes.length === 0 && (
        <p className="text-ink-soft text-[15px]">
          Nothing is hidden yet. Draw a box over anything you don&apos;t want to share.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {boxes.map((box) => (
          <li
            key={box.id}
            onClick={() => setSelected(box.id)}
            className={`flex flex-col gap-2 rounded border p-2 ${
              box.id === selected ? 'border-stamp bg-stamp-wash' : 'border-rule'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={box.enabled}
                onChange={(e) => patch(box.id, { enabled: e.target.checked })}
                aria-label={`Hide ${box.label}`}
                // 24px is the smallest a control may be under WCAG 2.5.8, and
                // this one decides whether a field is hidden at all.
                className="h-6 w-6 shrink-0"
              />
              <select
                value={box.label}
                onChange={(e) => {
                  const label = e.target.value;
                  patch(box.id, {
                    label,
                    style: allowsBlur(label) ? box.style : 'block',
                  });
                }}
                className="border-rule min-h-9 flex-1 rounded border bg-white px-1 py-1 font-mono text-xs"
              >
                {LABELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setBoxes((bs) => bs.filter((b) => b.id !== box.id));
                  if (selected === box.id) setSelected(null);
                }}
                aria-label={`Delete ${box.label} box`}
                // 44px target: this is a destructive control on a phone screen.
                className="text-ink-soft flex min-h-11 min-w-11 items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 pl-6">
              {/* The label is the target, not the dot: a 13px radio is a
                  fingernail on a phone, and the word beside it toggles the same
                  control for free. */}
              {(['block', 'blur'] as const).map((style) => (
                <label
                  key={style}
                  className={`flex min-h-9 items-center gap-1.5 rounded px-2 font-mono text-xs ${
                    style === 'blur' && !allowsBlur(box.label) ? 'text-ink-soft opacity-40' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={`style-${box.id}`}
                    checked={box.style === style}
                    disabled={style === 'blur' && !allowsBlur(box.label)}
                    onChange={() => patch(box.id, { style })}
                    className="h-4 w-4"
                  />
                  {style}
                </label>
              ))}
            </div>
            {box.source === 'suggested' && (
              <p className="text-ink-soft pl-6 text-xs">
                {box.label === 'QR code'
                  ? // Located by its finder patterns, never decoded; reading it
                    // would mean holding the data this tool exists to protect.
                    'Found by its shape. It was never decoded, so check the box covers the whole square.'
                  : 'Found by reading the page, but the digits didn’t check out. Confirm the box covers the number.'}
              </p>
            )}
            {!allowsBlur(box.label) && (
              <p className="text-ink-soft pl-6 text-xs">
                Blur is guessable on digits, so this one is always a solid block.
              </p>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
