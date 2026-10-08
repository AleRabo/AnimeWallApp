import type { Metadata } from 'next';
import SiteChrome from './site-chrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'AnimeWall - Streaming Next-Gen',
  description: 'Guarda anime in streaming HD in un\'interfaccia moderna.',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'AnimeWall',
    description: 'Streaming anime moderno e rapido.',
    images: ['/icon.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-[#08090c] font-sans text-neutral-100 bg-grid-pattern">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}