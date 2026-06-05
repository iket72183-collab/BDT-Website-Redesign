'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Logo } from './Logo';

const SECTIONS = [
  { label: 'How It Works', href: '/#how' },
  { label: 'Services', href: '/#service-preview' },
  { label: 'Plans', href: '/#plans' },
  { label: 'FAQ', href: '/#faq' },
];

/**
 * Top nav. Transparent over the hero, then frosts + hairlines after the user
 * scrolls 24px so it stays legible against any section. On mobile, the section
 * links collapse into a hamburger sheet — desktop keeps them inline.
 *
 * Lives in the page layout (not Hero) so it stays visible across the whole
 * landing flow.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock while the mobile sheet is open.
  useEffect(() => {
    if (open) {
      const prevBody = document.body.style.overflow;
      const prevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBody;
        document.documentElement.style.overflow = prevHtml;
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const desktopQuery = window.matchMedia('(min-width: 640px)');
    const onBreakpointChange = () => {
      if (desktopQuery.matches) setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    desktopQuery.addEventListener('change', onBreakpointChange);
    onBreakpointChange();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      desktopQuery.removeEventListener('change', onBreakpointChange);
    };
  }, [open]);

  return (
    <>
      <header
        className={
          'fixed inset-x-0 top-0 z-[70] transition-[background-color,backdrop-filter,border-color] duration-300 ' +
          (scrolled || open
            ? 'bg-bg-base/75 backdrop-blur-md border-b border-metal-border/20'
            : 'bg-transparent border-b border-transparent')
        }
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
          <Link href="/#top" className="-m-2 p-2" aria-label="BDT Connect — home">
            <Logo variant="mark" />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 sm:flex">
            {SECTIONS.map((s) => (
              <Link key={s.href} href={s.href}>
                <Button asAnchor variant="text" size="sm">
                  {s.label}
                </Button>
              </Link>
            ))}
            <Link href="/#plans" className="ml-2">
              <Button asAnchor variant="ghost" size="sm">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav-sheet"
            onClick={() => setOpen((o) => !o)}
            className="sm:hidden relative grid h-11 w-11 place-items-center rounded-lg border border-metal-border/40 bg-bg-surface/60 active:scale-95 transition-transform"
          >
            <span className="sr-only">Toggle navigation</span>
            {/* Animated hamburger to close */}
            <span
              aria-hidden
              className={
                'absolute h-px w-5 bg-metal-rose transition-transform duration-300 ease-[var(--bdt-ease-base)] ' +
                (open ? 'rotate-45' : '-translate-y-1.5')
              }
            />
            <span
              aria-hidden
              className={
                'absolute h-px w-5 bg-metal-rose transition-opacity duration-200 ' +
                (open ? 'opacity-0' : 'opacity-100')
              }
            />
            <span
              aria-hidden
              className={
                'absolute h-px w-5 bg-metal-rose transition-transform duration-300 ease-[var(--bdt-ease-base)] ' +
                (open ? '-rotate-45' : 'translate-y-1.5')
              }
            />
          </button>
        </nav>
      </header>

      {/* Keep the sheet outside the frosted header so fixed positioning stays viewport-based. */}
      <div
        id="mobile-nav-sheet"
        className={
          'sm:hidden fixed inset-x-0 bottom-0 z-[60] ' +
          'transition-[opacity,transform] duration-300 ease-[var(--bdt-ease-base)] ' +
          (open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none')
        }
        style={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}
        aria-hidden={!open}
      >
        <div
          className="h-full overflow-y-auto overscroll-contain bg-bg-base/95 backdrop-blur-xl"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
            // Atmospheric warmth so the overlay isn't flat black.
            backgroundImage:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,168,130,0.10), transparent 60%)',
          }}
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-6">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  onClick={() => setOpen(false)}
                  tabIndex={open ? 0 : -1}
                  className="flex min-h-14 items-center justify-between rounded-lg px-4 py-4 font-display text-display-md text-ink-primary active:bg-metal-rose/[0.08]"
                >
                  <span>{s.label}</span>
                  <span aria-hidden className="text-metal-rose text-2xl leading-none">›</span>
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <Link
                href="/#plans"
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                className="block"
              >
                <Button asAnchor variant="primary" size="lg" className="w-full">
                  Get Started
                </Button>
              </Link>
            </li>
          </ul>

          {/* Bottom-of-overlay attribution */}
          <div className="mt-auto px-5 pt-8 text-center">
            <div className="font-body text-caption uppercase tracking-label text-ink-subtle">
              A product of BDT Talent Group
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
