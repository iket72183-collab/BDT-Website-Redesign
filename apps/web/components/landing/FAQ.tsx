'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'What does BDT Connect handle each month?',
    answer:
      'BDT Connect covers the ongoing digital work most small businesses need: creative assets, social posts and captions, website edits, calendar updates, reporting, and direct messaging with your BDT team.',
  },
  {
    question: 'How do requests and communication work?',
    answer:
      'You send priorities, files, links, and notes through BDT Connect. The team keeps the work organized, follows up when details are needed, and uses the same channel for updates and approvals.',
  },
  {
    question: 'How quickly does service start?',
    answer:
      'Service starts when you sign up. BDT follows up for onboarding details, brand assets, website access, and the first set of priorities so the monthly workflow can begin cleanly.',
  },
  {
    question: 'Is there a long-term contract?',
    answer:
      'No long-term contract is required. Premium is a monthly service, and you can cancel from the billing portal before the next billing period.',
  },
  {
    question: 'Is the Premium plan really $100/month?',
    answer:
      'Yes. Premium is listed at $100 per month. If your needs grow beyond the standard monthly service, BDT will discuss scope and pricing with you before any billing changes.',
  },
  {
    question: 'How does the AI Consultation work?',
    answer:
      'Every business is different, so we handle AI Consultation on a case-by-case basis. We review your workflow, recommend the right AI agents or automations, and help install and set them up for your business.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <section
      id="faq"
      className="relative mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-14 sm:px-10 sm:py-28"
    >
      <div className="grid gap-7 sm:gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <div className="font-body text-caption uppercase tracking-label text-metal-rose">
            FAQ
          </div>
          <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] text-ink-primary sm:text-display-xl">
            Clear answers before you begin.
          </h2>
          <p className="mt-4 max-w-xl font-body text-body-sm leading-relaxed text-ink-muted sm:mt-5 sm:text-body-lg">
            Premium is built to feel calm and predictable: one monthly service,
            one team, and a simple path for keeping your digital presence moving.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;
            const toggleOpen = () => setOpenIndex(isOpen ? -1 : index);

            return (
              <div
                key={item.question}
                className={[
                  'overflow-hidden rounded-xl border bg-bg-surface/35 shadow-card backdrop-blur-md',
                  'transition-[border-color,background-color,box-shadow] duration-300 ease-[var(--bdt-ease-base)]',
                  isOpen
                    ? 'border-metal-rose/55 bg-bg-surface/70 shadow-glow'
                    : 'border-metal-border/20 hover:border-metal-rose/40 hover:bg-bg-surface/55',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={toggleOpen}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleOpen();
                    }
                  }}
                  className="group flex w-full items-start justify-between gap-4 px-4 py-4 text-left outline-none transition-colors duration-300 focus-visible:bg-metal-rose/[0.08] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-metal-rose/60 sm:px-6 sm:py-5"
                >
                  <span className="grid gap-1">
                    <span className="font-body text-caption uppercase tracking-label text-ink-subtle">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-xl leading-snug text-ink-primary sm:text-2xl">
                      {item.question}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={[
                      'mt-1 grid size-9 shrink-0 place-items-center rounded-lg border border-metal-border/35',
                      'text-metal-rose transition-[transform,border-color,background-color] duration-300 ease-[var(--bdt-ease-base)]',
                      'group-hover:border-metal-rose/60 group-hover:bg-metal-rose/[0.06]',
                      isOpen ? 'rotate-45 bg-metal-rose/[0.08]' : '',
                    ].join(' ')}
                  >
                    <span className="relative block size-3">
                      <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current" />
                    </span>
                  </span>
                </button>

                <div
                  id={answerId}
                  aria-hidden={!isOpen}
                  className={[
                    'grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--bdt-ease-base)]',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  ].join(' ')}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 pb-5 font-body text-body-sm leading-relaxed text-ink-muted sm:px-6 sm:pb-6 sm:text-body-md">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
