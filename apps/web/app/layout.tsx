import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { ScrollReveal } from '@/components/ScrollReveal';
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

const connectShareImage = 'https://bdttalentgroup.com/connect/brand/bdt-connect-share.jpg';

export const metadata: Metadata = {
  title: 'BDT Connect — Your entire online presence. $100/month.',
  description:
    'BDT Talent Group manages monthly creative assets, social media requests, website updates, reporting, and direct messaging for $100/month.',
  metadataBase: new URL('https://bdttalentgroup.com/connect/'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BDT Connect',
    description: 'Your entire online presence. $100/month.',
    type: 'website',
    url: '/',
    images: [
      {
        url: connectShareImage,
        width: 1200,
        height: 630,
        alt: 'BDT Connect gold logo on a black premium service banner',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BDT Connect',
    description: 'Your entire online presence. $100/month.',
    images: [connectShareImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-bg-base font-body text-ink-primary antialiased">
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}
