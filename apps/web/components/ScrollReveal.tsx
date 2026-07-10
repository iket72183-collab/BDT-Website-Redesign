'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const REVEAL_SELECTOR = '[data-reveal]';
const GROUP_SELECTOR = '[data-reveal-group]';

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const generatedItems = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal-sections] > section'),
    );
    generatedItems.forEach((item) => item.setAttribute('data-reveal', ''));
    const items = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

    if (!items.length) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileViewport = window.matchMedia('(max-width: 639px)').matches;
    const cleanupTimers = new Set<number>();
    let observer: IntersectionObserver | null = null;
    let scrollFrame = 0;

    const clearRevealClasses = (item: HTMLElement) => {
      item.classList.remove('reveal-pending', 'is-revealed');
      item.style.removeProperty('--reveal-delay');
    };

    const showAll = () => {
      observer?.disconnect();
      root.classList.remove('reveal-active');
      items.forEach((item) => {
        item.classList.remove('reveal-pending');
        item.classList.add('is-revealed');
      });
    };

    const reveal = (item: HTMLElement) => {
      if (item.classList.contains('is-revealed')) return;

      item.classList.add('is-revealed');
      observer?.unobserve(item);

      const delay = Number.parseInt(item.style.getPropertyValue('--reveal-delay'), 10) || 0;
      const timer = window.setTimeout(() => {
        item.classList.remove('reveal-pending');
        cleanupTimers.delete(timer);
      }, delay + 550);
      cleanupTimers.add(timer);
    };

    const revealReachedItems = () => {
      scrollFrame = 0;

      try {
        items.forEach((item) => {
          if (!item.classList.contains('reveal-pending')) return;

          const rect = item.getBoundingClientRect();
          if (rect.top < window.innerHeight * 1.02) reveal(item);
        });
      } catch {
        showAll();
      }
    };

    const scheduleReachedCheck = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(revealReachedItems);
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) showAll();
    };

    const supportsModernMotionListener =
      typeof motionPreference.addEventListener === 'function';

    try {
      document.querySelectorAll<HTMLElement>(GROUP_SELECTOR).forEach((group) => {
        const groupItems = Array.from(group.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
        groupItems.forEach((item, index) => {
          const step = mobileViewport ? 40 : 55;
          const maximum = mobileViewport ? 80 : 165;
          item.style.setProperty('--reveal-delay', `${Math.min(index * step, maximum)}ms`);
        });
      });

      if (motionPreference.matches || !('IntersectionObserver' in window)) {
        showAll();
        return;
      }

      const pendingItems: HTMLElement[] = [];
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const isAlreadyReached = rect.bottom < 0 || rect.top < window.innerHeight * 0.92;

        if (isAlreadyReached) {
          item.classList.add('is-revealed');
        } else {
          item.classList.add('reveal-pending');
          pendingItems.push(item);
        }
      });

      observer = new IntersectionObserver(
        (entries) => {
          try {
            entries.forEach((entry) => {
              if (entry.isIntersecting) reveal(entry.target as HTMLElement);
            });
          } catch {
            showAll();
          }
        },
        { threshold: 0.04, rootMargin: '0px 0px -8% 0px' },
      );

      pendingItems.forEach((item) => observer?.observe(item));
      root.classList.add('reveal-active');

      window.addEventListener('scroll', scheduleReachedCheck, { passive: true });
      window.addEventListener('pageshow', scheduleReachedCheck);
      if (supportsModernMotionListener) {
        motionPreference.addEventListener('change', handleMotionChange);
      } else {
        motionPreference.addListener(handleMotionChange);
      }
      scheduleReachedCheck();
    } catch {
      showAll();
    }

    return () => {
      observer?.disconnect();
      cleanupTimers.forEach((timer) => window.clearTimeout(timer));
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', scheduleReachedCheck);
      window.removeEventListener('pageshow', scheduleReachedCheck);
      if (supportsModernMotionListener) {
        motionPreference.removeEventListener('change', handleMotionChange);
      } else {
        motionPreference.removeListener(handleMotionChange);
      }
      root.classList.remove('reveal-active');
      items.forEach(clearRevealClasses);
      generatedItems.forEach((item) => item.removeAttribute('data-reveal'));
    };
  }, [pathname]);

  return null;
}
