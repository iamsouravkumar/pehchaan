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

export const metadata: Metadata = {
  // Absolute URLs for the link preview. The card image itself lives at
  // app/opengraph-image.tsx and is rasterised into the export at build time.
  metadataBase: new URL('https://usepehchaan.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Pehchaan',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
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
