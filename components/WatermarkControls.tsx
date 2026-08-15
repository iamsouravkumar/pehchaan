'use client';

import { stampDate } from '@/lib/redact/watermark';
import { PRESETS, type Preset } from '@/lib/purpose';
import { spoken } from '@/lib/boxes';

export default function WatermarkControls({
  on,
  setOn,
  purpose,
  setPurpose,
  onPreset,
  revealed,
}: {
  on: boolean;
  setOn: (on: boolean) => void;
  purpose: string;
  setPurpose: (purpose: string) => void;
  /** Applies the preset's field policy as well as its text. */
  onPreset: (preset: Preset) => void;
  /** Labels this page still shows after the chosen preset, if any. */
  revealed: { preset: Preset; labels: string[] } | null;
}) {
  return (
    <aside className="border-rule bg-surface flex w-full flex-col gap-4 rounded-lg border p-4 md:w-72">
      {/* Outside the stamp toggle on purpose: a preset decides which fields are
          hidden, which matters whether or not the copy gets stamped. */}
      <div className="flex flex-col gap-2">
        <span className="text-ink-soft text-[13px] font-medium tracking-[0.02em]">
          What is this copy for?
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onPreset(preset)}
              aria-pressed={purpose === preset.name}
              className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                purpose === preset.name
                  ? 'border-stamp bg-stamp-wash text-stamp'
                  : 'border-rule text-ink-soft'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Bank KYC"
          aria-label="What is this copy for?"
          className="border-rule rounded border bg-white px-2 py-1.5 font-mono text-sm"
        />
      </div>

      {/* Say plainly what the preset did. A tool that silently un-hides a field
          has made a decision the user never saw (PRD §8). */}
      {revealed && (
        <div className="border-rule flex flex-col gap-1 border-t pt-3">
          <p className="text-ink text-[15px]">
            {revealed.labels.length
              ? `Hiding everything except ${list(revealed.labels)}.`
              : 'Hiding everything found on this page.'}
          </p>
          <p className="text-ink-soft text-[13px]">{revealed.preset.note}</p>
          <p className="text-ink-soft text-[13px]">
            Go back a step to change any of it — nothing here is fixed.
          </p>
        </div>
      )}

      <label className="border-rule flex items-center gap-2 border-t pt-3 text-[15px]">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        Stamp what this copy is for
      </label>

      {on ? (
        <p className="text-ink-soft text-[13px]">
          Today&apos;s date is added automatically and can&apos;t be changed — a back-dated stamp
          would be worth nothing.
          <span className="text-ink mt-1 block font-mono text-xs">{stampDate()}</span>
        </p>
      ) : (
        <p className="text-ink-soft text-[15px]">
          No stamp will be added. The hidden areas are still hidden.
        </p>
      )}
    </aside>
  );
}

function list(labels: string[]): string {
  const said = labels.map(spoken);
  return said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said.at(-1)}` : said[0];
}
