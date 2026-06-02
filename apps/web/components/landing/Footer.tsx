import Link from 'next/link';
import { Logo } from './Logo';

const groups = [
  {
    title: 'Product',
    links: [
      { label: 'How It Works', href: '/#how' },
      { label: 'Services', href: '/#service-preview' },
      { label: 'Plans', href: '/#plans' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'BDT Talent Group', href: 'https://bdttalentgroup.com/' },
      { label: 'About', href: 'https://bdttalentgroup.com/#about' },
      { label: 'Contact', href: 'https://bdttalentgroup.com/#contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="relative mt-16 sm:mt-24 border-t border-metal-border/20"
      // Leave room for the sticky mobile CTA + iOS home indicator so links
      // aren't covered.
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-5 pt-10 pb-8 sm:gap-12 sm:px-10 sm:pt-16 sm:pb-0 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Logo variant="mark" />
          <p className="mt-4 max-w-sm font-body text-body-sm text-ink-muted">
            BDT Connect is the private client app for BDT Talent Group — your agency
            on retainer for website, social, and ongoing support.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <div className="font-body text-caption uppercase tracking-label text-metal-rose">
              {g.title}
            </div>
            <ul className="mt-4 -ml-2 space-y-1">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    // Min 44x44 tap target — extend with padding rather than font size.
                    className="inline-flex min-h-11 items-center rounded px-2 py-2 font-body text-body-sm text-ink-muted transition-colors hover:text-ink-primary active:text-metal-rose"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-metal-border/15">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-6 py-6 text-center sm:px-10">
          <div className="font-body text-caption uppercase tracking-label text-ink-subtle">
            © {new Date().getFullYear()} BDT Talent Group · All rights reserved
          </div>
        </div>
      </div>
    </footer>
  );
}
