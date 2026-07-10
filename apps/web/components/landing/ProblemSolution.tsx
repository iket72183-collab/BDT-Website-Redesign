const items = [
  {
    eyebrow: 'The Problem',
    title: 'A website nobody updates',
    body:
      'You paid for a website years ago. The IT people moved on. Now it loads slow, looks outdated, and nobody on your team knows how to fix it.',
  },
  {
    eyebrow: 'The Problem',
    title: "You don't have the time",
    body:
      "You need someone to maintain and update your website, a social-media person, someone to respond to DM's or emails, keep up with trends in your industry. But you have no time.",
  },
  {
    eyebrow: 'The Solution',
    title: 'One agency. One app. One retainer.',
    body:
      'BDT Connect runs your website and social media accounts on retainer, and sends you every update on a private app where you can see the work and message our team. Simple and efficient.',
    accent: true,
  },
];

export function ProblemSolution() {
  return (
    <section id="how" className="connect-section relative mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-16 sm:px-10 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute left-[12%] top-1/2 hidden h-px w-[76%] bg-gradient-to-r from-transparent via-metal-border/35 to-transparent md:block" />
      <div
        data-reveal-group
        className="relative grid gap-4 sm:gap-6 md:grid-cols-[0.95fr_0.95fr_1.1fr] md:items-stretch"
      >
        {items.map((it) => (
          <div key={it.title} data-reveal className="h-full">
            <div
              className={
                'group relative h-full overflow-hidden rounded-2xl p-5 sm:p-8 transition-all duration-300 ease-[var(--bdt-ease-base)] ' +
                (it.accent
                  ? 'glass metal-frame shadow-glow-strong md:-translate-y-4 hover:-translate-y-5'
                  : 'border border-metal-border/20 bg-bg-surface/45 shadow-card hover:-translate-y-1 hover:border-metal-rose/35 hover:bg-bg-surface/65')
              }
            >
              <div
                aria-hidden
                className={
                  'absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300 ' +
                  (it.accent ? 'via-metal-rose opacity-100' : 'via-metal-border/60 opacity-60 group-hover:opacity-100')
                }
              />
              <div aria-hidden className="absolute -right-10 -top-10 size-28 rounded-full border border-metal-border/10 bg-metal-rose/[0.015]" />
              <div
                className={
                  'relative font-body text-caption uppercase tracking-label ' +
                  (it.accent ? 'text-metal-rose' : 'text-ink-subtle')
                }
              >
                {it.eyebrow}
              </div>
              <h3
                className={
                  'relative mt-3 font-display text-2xl leading-tight sm:text-display-md ' +
                  (it.accent ? 'text-metal-shimmer' : 'text-ink-primary')
                }
              >
                {it.title}
              </h3>
              <p className="relative mt-3 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-4 sm:text-body-md">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
