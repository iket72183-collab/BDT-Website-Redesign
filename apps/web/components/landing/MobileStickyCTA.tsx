'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';

/**
 * Sticky bottom plans CTA — only on mobile (`sm:hidden`). Hidden initially
 * (so the hero CTAs do the work), then fades in after the user scrolls past
 * the first viewport. Disappears again when they reach the plans section
 * so it doesn't double up with the in-page CTA.
 */
export function MobileStickyCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.7;
      // Hide while an in-page action is already doing the work. Reappear once
      // those sections scroll away so the action stays one tap away elsewhere.
      const inActionSection = ['plans', 'connect-contact'].some((id) => {
        const section = document.getElementById(id);
        if (!section) return false;
        const r = section.getBoundingClientRect();
        return r.top < window.innerHeight - 80 && r.bottom > 80;
      });
      setShow(past && !inActionSection);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={
        'fixed inset-x-0 bottom-0 z-30 sm:hidden ' +
        'transition-[transform,opacity] duration-300 ease-[var(--bdt-ease-base)] ' +
        (show
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none')
      }
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Gradient fade so the CTA reads as floating over content, not pasted on. */}
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-bg-base to-transparent" />
      <div className="relative border-t border-metal-border/25 bg-bg-base/90 px-5 py-3 backdrop-blur-md">
        <Link href="#plans" tabIndex={show ? 0 : -1} className="block">
          <Button asAnchor variant="primary" size="md" className="w-full">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
}
