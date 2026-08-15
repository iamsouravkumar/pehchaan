'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll reveal: one pattern, applied consistently, fired once (LANDING.md §5).
 *
 * The content is in the markup already and visible by default; the class only
 * animates it in once it has been seen. That ordering matters — a reveal that
 * starts from `opacity: 0` in CSS leaves the whole page blank for anyone whose
 * JavaScript failed, which is a strange fate for a page arguing that the tool
 * degrades gracefully.
 */
export default function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    // Only hide-then-reveal when we know we can reveal.
    setArmed(true);
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return setSeen(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSeen(true);
        observer.disconnect(); // once: re-animating on every pass gets irritating
      },
      { rootMargin: '-12% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${armed && !seen ? 'reveal-hidden' : seen ? 'reveal-in' : ''} ${className}`}>
      {children}
    </div>
  );
}
