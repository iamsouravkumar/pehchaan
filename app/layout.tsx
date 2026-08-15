import type { Metadata } from 'next';
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

// next/font downloads at build time and serves from our own origin.
// Nothing is fetched from fonts.googleapis.com at runtime — TRD §1.
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

export const metadata: Metadata = {
  title: 'Pehchaan — Share your document. Not your identity.',
  description:
    "Hide the parts they don't need — the Aadhaar number, the address, the photo — and stamp what it's for. Runs entirely in your browser. Your document never leaves your device.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}
      >
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
