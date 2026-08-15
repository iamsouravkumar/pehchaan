'use client';

import { useRef, useState } from 'react';
import { ACCEPTED_TYPES } from '@/lib/image/normalise';

export default function DropZone({
  onFile,
  error,
}: {
  onFile: (file: File) => void;
  error: string | null;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function take(files: FileList | null) {
    if (files?.[0]) onFile(files[0]);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={`press-soft flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-8 py-16 ${
          // Dragging a file over it is a stronger signal than hovering, so it
          // gets the accent; hover only warms the surface and firms the edge.
          over
            ? 'border-action bg-action-wash'
            : 'border-rule bg-surface hover:border-ink-soft hover:bg-action-wash'
        }`}
      >
        <span className="font-display text-2xl">Add your document</span>
        <span className="text-ink-soft text-[15px]">
          {over ? 'Drop it here' : 'Drop a photo here, or click to choose one'}
        </span>
      </button>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => take(e.target.files)}
      />

      {error && (
        <p role="alert" className="text-alert text-[15px]">
          {error}
        </p>
      )}

      <p className="text-ink-soft font-mono text-xs">
        works offline · no account · nothing stored
      </p>
    </div>
  );
}
