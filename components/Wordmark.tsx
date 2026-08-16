'use client';

import Link from 'next/link';

/**
 * PEHCHAAN with a redaction bar over the middle four letters, sliding away on
 * first load: what's hidden can be revealed, and you decide. The product's whole
 * thesis in one gesture (DESIGN.md §2).
 *
 * The word underneath is always present in the DOM: the bar is a sibling that
 * moves, never a text swap, so the accessible name is "PEHCHAAN" at every
 * frame, and a reader with reduced motion sees the finished state immediately.
 */
export default function Wordmark({
  href,
  onNavigate,
}: {
  href?: string;
  /** Called before following the link. Prevent the event to stay put. */
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const word = (
    <span className="font-display relative inline-block text-2xl leading-none tracking-[0.01em]">
      PEHCHAAN
      {/* Covers HCHA: 2 characters in, 4 wide. In ch units so it tracks the
          type size rather than needing a magic pixel value per breakpoint. */}
      <span aria-hidden className="wordmark-bar bg-redact absolute" />
    </span>
  );

  // A link only where there is somewhere to go. On the landing page the
  // wordmark already is the page, and a link to itself is a dead end that
  // reads as one more thing to try.
  return href ? (
    <Link href={href} aria-label="Pehchaan home" className="inline-block" onClick={onNavigate}>
      {word}
    </Link>
  ) : (
    word
  );
}
