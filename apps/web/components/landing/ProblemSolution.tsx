const items = [
  {
    eyebrow: 'The Problem',
    title: 'A website nobody updates',
    body:
      'You paid for a website years ago. The IT people moved on. Now it loads slow, looks outdated, and nobody on your team knows how to fix it.',
  },
  {
    eyebrow: 'The Problem',
    title: 'You don't have the time',
    body:
      'You need someone to maintain and update your website, a social-media person, someone to respond to DM's or emails, keep up with trends in your industry. But you have no time.',
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
