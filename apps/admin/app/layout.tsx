import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'BDT Connect — Admin',
  description: 'Manage clients, messages, and revenue for BDT Talent Group.',
  // No social previews — this surface is internal-only.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-bg-base text-ink-primary antialiased">
        {children}
      </body>
    </html>
  );
}
