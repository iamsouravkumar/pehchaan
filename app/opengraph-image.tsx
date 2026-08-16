import { ImageResponse } from 'next/og';

/**
 * The link preview card, generated at build time into a static PNG.
 *
 * It is the same argument the landing page makes, in the one second someone
 * spends looking at a link: a document with its fields struck out, the stamp
 * that says what the copy is for, and the claim that nothing was uploaded.
 * Drawn rather than photographed, because a screenshot of a real document is
 * exactly the thing this product exists to prevent.
 *
 * next/og rasterises this during `next build`, so the export ships a plain file
 * and nothing is generated at request time. There is no server to generate it
 * on (TRD §1).
 */
// Required under `output: export`: without it the build treats this as a route
// to be served on demand, and there is no runtime to serve it.
export const dynamic = 'force-static';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Pehchaan: share your document, not your identity';

// The design tokens, repeated rather than imported: this renders outside the
// browser, where the stylesheet does not exist.
const PAPER = '#f5f5f2';
const INK = '#17181b';
const SOFT = '#5c6068';
const RULE = '#ddddd7';
const REDACT = '#0a0a0b';
const ACTION = '#f97316';

/** A struck-out field: its label, and the bar where the value used to be. */
function Field({ label, width }: { label: string; width: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 150, fontSize: 17, color: SOFT, letterSpacing: 1 }}>{label}</div>
      <div style={{ width, height: 26, background: REDACT, borderRadius: 3 }} />
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: PAPER,
          color: INK,
          padding: 72,
          gap: 64,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 12, background: ACTION, borderRadius: 2 }} />
            <div style={{ fontSize: 24, letterSpacing: 6, color: SOFT }}>PEHCHAAN</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 62, lineHeight: 1.1 }}>
            <div>Share your document.</div>
            <div>Not your identity.</div>
          </div>

          <div style={{ fontSize: 26, color: SOFT, lineHeight: 1.4, maxWidth: 560 }}>
            Hide the Aadhaar number, the address, the photo. Stamp what the copy is for.
          </div>

          {/* Stacked, not side by side: at 1200px the two sat on one line only
              just, and the tagline wrapped mid-phrase. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                background: ACTION,
                color: INK,
                padding: '12px 20px',
                borderRadius: 6,
                fontSize: 23,
              }}
            >
              usepehchaan.vercel.app
            </div>
            <div style={{ fontSize: 20, color: SOFT }}>
              no account · nothing uploaded · works offline
            </div>
          </div>
        </div>

        {/* The card, mid-redaction. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            width: 420,
            padding: 34,
            background: '#ffffff',
            border: `1px solid ${RULE}`,
            borderRadius: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: SOFT, letterSpacing: 1 }}>
            <div>SAMPLE CARD</div>
            <div>FABRICATED DATA</div>
          </div>
          <Field label="NAME" width={170} />
          <Field label="DOB" width={110} />
          <Field label="ADDRESS" width={210} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 150, fontSize: 17, color: SOFT, letterSpacing: 1 }}>NUMBER</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 128, height: 26, background: REDACT, borderRadius: 3 }} />
              <div style={{ fontSize: 20 }}>9012</div>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 19, color: ACTION, paddingTop: 6 }}>
            For Bank KYC only · 16 Aug 2026
          </div>
        </div>
      </div>
    ),
    size,
  );
}
