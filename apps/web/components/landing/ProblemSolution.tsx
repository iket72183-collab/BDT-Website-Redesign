const items = [
  {
    eyebrow: 'The Problem',
    title: 'A website nobody updates',
    body:
      'You paid for a site two years ago. The agency moved on. The plugins broke. Now it loads slow, looks dated, and nobody on your team knows how to fix it.',
  },
  {
    eyebrow: 'The Problem',
    title: 'Five vendors, one mess',
    body:
      'A web freelancer, a social-media person, a SEO consultant, a hosting bill, an email tool. Different invoices, different chat threads, different excuses.',
  },
  {
    eyebrow: 'The Solution',
    title: 'One agency. One app. One retainer.',
    body:
      'BDT Talent Group runs your web and social on retainer, and ships every update to a private app where you can see the work and message the team.',
    accent: true,
  },
];

export function ProblemSolution() {
  return (
    <section id="how" className="relative mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-14 sm:px-10 sm:py-28">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className={
              'relative rounded-2xl p-5 sm:p-8 transition-all duration-300 ease-[var(--bdt-ease-base)] ' +
              (it.accent
                ? 'glass metal-frame shadow-card hover:shadow-glow-strong'
                : 'border border-metal-border/15 bg-bg-surface/40')
            }
          >
            <div
              className={
                'font-body text-caption uppercase tracking-label ' +
                (it.accent ? 'text-metal-rose' : 'text-ink-subtle')
              }
            >
              {it.eyebrow}
            </div>
            <h3
              className={
                'mt-3 font-display text-2xl sm:text-display-md ' +
                (it.accent ? 'text-metal-shimmer' : 'text-ink-primary')
              }
            >
              {it.title}
            </h3>
            <p className="mt-3 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-4 sm:text-body-md">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
