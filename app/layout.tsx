import type { Metadata } from 'next';
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

// next/font downloads at build time and serves from our own origin.
// Nothing is fetched from fonts.googleapis.com at runtime (TRD §1).
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const TITLE = 'Pehchaan: Share your document. Not your identity.';
const DESCRIPTION =
  "Hide the parts they don't need: the Aadhaar number, the address, the photo. Then stamp what it's for. Runs entirely in your browser. Your document never leaves your device.";

/**
 * The link preview card, as a plain file in public/.
 *
 * It was generated with next/og, but the generated route could not be served:
 * `trailingSlash` sends /opengraph-image to a 308, and the extensionless file
 * a static export leaves behind is served as application/octet-stream, which
 * every scraper refuses to render as an image. A committed PNG has the right
 * content type and no redirect. The generator is in the history if the card
 * ever needs redrawing: `git show eea574f:app/opengraph-image.tsx`.
 */
const CARD = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Pehchaan: share your document, not your identity',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://usepehchaan.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Pehchaan',
    type: 'website',
    images: [CARD],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [CARD],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
