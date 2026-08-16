import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import SampleCard from '@/components/landing/SampleCard';
import ProofStrip from '@/components/landing/ProofStrip';
import Reveal from '@/components/landing/Reveal';

/**
 * The landing page (LANDING.md).
 *
 * The visitor arrives suspicious; they have been told before that something was
 * private and found out otherwise. The page has one job: make the claim feel
 * provable rather than promised, before they upload anything. Hence a card that
 * redacts itself, a counter reading real numbers, and mechanisms rather than
 * adjectives.
 *
 * A server component with no client JavaScript of its own. The tool lives at
 * /tool so its several megabytes of WASM never load for someone who is only
 * reading (LANDING.md §6).
 */

const STEPS = [
  {
    n: '01',
    title: 'Add your document',
    body: 'Photo or PDF. Aadhaar, PAN, marksheet, bill, anything.',
  },
  {
    n: '02',
    title: "Review what's hidden",
    body: 'It finds the sensitive fields. You check them, and box anything it missed.',
  },
  {
    n: '03',
    title: 'Add a purpose',
    body: "Stamp what the copy is for, so it can't be quietly reused.",
  },
  {
    n: '04',
    title: 'Save',
    body: 'The hidden parts are gone from the pixels, not covered by a removable layer.',
  },
];

const PROOFS = [
  {
    title: "There's no server to send it to.",
    body: 'Pehchaan is a static site. There is no backend, no API, no database. Even if the code wanted to upload your document, there is nowhere for it to go.',
  },
  {
    title: 'The engine runs in your browser.',
    body: 'Text recognition happens locally in WebAssembly. The engine and its language data are served from this site, not fetched from anyone else’s.',
  },
  {
    title: 'Turn off your wifi and it still works.',
    body: 'The strongest proof available. Load the page, disconnect, redact a document. Nothing changes.',
  },
];

export default function Landing() {
  return (
    <main>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Wordmark />
        <Link
          href="/tool"
          className="border-rule press rounded border px-3.5 py-2 text-[15px] whitespace-nowrap"
        >
          Open tool
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pt-10 pb-16 md:grid-cols-2 md:pt-16">
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.08]">
            {/* Two lines, staggered: the second half is the turn. */}
            <span className="rise-in block" style={{ animationDelay: '0.15s' }}>
              Share your document.
            </span>
            <span className="rise-in block" style={{ animationDelay: '0.24s' }}>
              Not your identity.
            </span>
          </h1>

          <p
            className="text-ink-soft rise-in max-w-prose text-[17px] leading-relaxed"
            style={{ animationDelay: '0.33s' }}
          >
            Hide the parts they don&apos;t need: the Aadhaar number, the address, the photo. Then
            stamp what it&apos;s for. Runs entirely in your browser. Your document never leaves your
            device.
          </p>

          <div
            className="rise-in flex flex-col items-start gap-3"
            style={{ animationDelay: '0.42s' }}
          >
            <Link
              href="/tool"
              className="bg-action hover:bg-action-hover press text-ink rounded px-5 py-3 text-[17px] font-medium"
            >
              Open Pehchaan
            </Link>
            <p className="text-ink-soft font-mono text-xs">
              no account · nothing uploaded · works offline
            </p>
          </div>
        </div>

        <div
          className="rise-in flex justify-center md:justify-end"
          style={{ animationDelay: '0.51s' }}
        >
          <SampleCard />
        </div>
      </section>

      <ProofStrip />

      <Reveal className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display mb-8 text-[28px]">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="border-rule step-card bg-surface flex flex-col gap-2 rounded-lg border p-4"
            >
              <span className="text-action-ink font-mono text-xs">{step.n}</span>
              <h3 className="text-[17px] font-medium">{step.title}</h3>
              <p className="text-ink-soft text-[15px] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display mb-2 text-[28px]">Why nothing is uploaded</h2>
        <p className="text-ink-soft mb-8 text-[15px]">The mechanism, not the marketing.</p>
        <div className="grid gap-8 md:grid-cols-3">
          {PROOFS.map((proof) => (
            <div key={proof.title} className="flex flex-col gap-2">
              <h3 className="text-[17px] font-medium">{proof.title}</h3>
              <p className="text-ink-soft text-[15px] leading-relaxed">{proof.body}</p>
            </div>
          ))}
        </div>
        <p className="text-ink-soft mt-8 text-[15px]">
          The code is open:{' '}
          <a
            href="https://github.com/iamsouravkumar/pehchaan"
            className="text-action-ink underline underline-offset-4"
          >
            read it yourself
          </a>
          .
        </p>
      </Reveal>

      <Reveal className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display mb-8 text-[28px]">What it handles</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-xs tracking-wide uppercase">Detected automatically</h3>
            <p className="text-[15px] leading-relaxed">
              Aadhaar: number, date of birth, address, photo, QR code. PAN: number, date of birth,
              photo.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-ink-soft font-mono text-xs tracking-wide uppercase">
              Everything else, your call
            </h3>
            <p className="text-[15px] leading-relaxed">
              Marksheets, certificates, bills, agreements, offer letters. Common patterns like dates
              and addresses are found automatically; anything else, you box it yourself in two
              seconds.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal className="border-rule border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 py-20 text-center">
          <p className="font-display text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.1]">
            Share your document.
            <br />
            Not your identity.
          </p>
          <Link
            href="/tool"
            className="bg-action hover:bg-action-hover press text-ink rounded px-5 py-3 text-[17px] font-medium"
          >
            Open Pehchaan
          </Link>
        </div>
      </Reveal>

      <footer className="border-rule border-t">
        <div className="text-ink-soft mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-xs">
          <span>Pehchaan · built for CodeStorm 2026</span>
          <a
            href="https://github.com/iamsouravkumar/pehchaan"
            className="underline underline-offset-4"
          >
            Source
          </a>
        </div>
      </footer>
    </main>
  );
}
