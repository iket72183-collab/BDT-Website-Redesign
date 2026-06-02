import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  // `cover` lets the page paint behind iOS notches; we use env(safe-area-inset-*)
  // in globals.css and the sticky bottom CTA to compensate.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--bdt-font-body',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--bdt-font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'BDT Connect — Your online presence, professionally delivered.',
  description:
    'BDT Talent Group manages your social media, website, and creative assets for $150/month — delivered through a private client app.',
  metadataBase: new URL('https://bdttalentgroup.com/connect/'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BDT Connect',
    description: 'Your online presence, professionally delivered.',
    type: 'website',
    url: '/',
    images: [
      {
        url: 'https://bdttalentgroup.com/assets/bdt-logo.jpeg',
        alt: 'BDT Talent Group',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BDT Connect',
    description: 'Your online presence, professionally delivered.',
    images: ['https://bdttalentgroup.com/assets/bdt-logo.jpeg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-bg-base font-body text-ink-primary antialiased">
        {children}
      </body>
    </html>
  );
}
