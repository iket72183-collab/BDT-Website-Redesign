import { Card, CardBody, CardEyebrow, CardTitle } from '../ui/Card';

type ServiceIconName = 'create' | 'promote' | 'maintain' | 'report' | 'connect';

function ServiceIcon({ name }: { name: ServiceIconName }) {
  const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      {name === 'create' && (
        <>
          <path d="M8 5.5h11l5 5V25a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z" {...shared} />
          <path d="M19 5.5v5h5M10 21l4-4 3 3 5-6" {...shared} />
        </>
      )}
      {name === 'promote' && (
        <>
          <path d="m6 14 14-6v16L6 18v-4ZM20 12c3 1 5 3 5 6s-2 5-5 6" {...shared} />
          <path d="m9 19 2 7h4l-1.5-5.5" {...shared} />
        </>
      )}
      {name === 'maintain' && (
        <>
          <rect x="4.5" y="6" width="23" height="19" rx="3" {...shared} />
          <path d="M5 11h22M9 9h.01M13 9h.01M11 18l3 3 7-8" {...shared} />
        </>
      )}
      {name === 'report' && (
        <>
          <path d="M7 26V14M13 26V9M19 26V17M25 26V5M5 26h22" {...shared} />
          <path d="m7 11 6-5 6 7 6-9" {...shared} />
        </>
      )}
      {name === 'connect' && (
        <>
          <path d="M7 7h14a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-7l-6 5v-5H7a4 4 0 0 1-4-4v-7a4 4 0 0 1 4-4Z" {...shared} />
          <path d="M9 14h10M9 18h7" {...shared} />
        </>
      )}
    </svg>
  );
}

const services = [
  {
    icon: 'create' as const,
    eyebrow: 'Create',
    title: 'AI Creative Assets',
    body:
      'Flyers, promos, graphics, and social visuals shaped for your brand.',
  },
  {
    icon: 'promote' as const,
    eyebrow: 'Promote',
    title: 'Social Media Management',
    body:
      'Posts, captions, scheduling, and engagement support for your social presence.',
  },
  {
    icon: 'maintain' as const,
    eyebrow: 'Maintain',
    title: 'Website Updates',
    body:
      'Edits, fixes, maintenance, and calendar updates to keep your site current.',
  },
  {
    icon: 'report' as const,
    eyebrow: 'Report',
    title: 'Performance Reporting',
    body:
      'Monthly reporting on social growth, website traffic, and useful insights.',
  },
  {
    icon: 'connect' as const,
    eyebrow: 'Connect',
    title: 'Direct Messaging',
    body:
      'Direct messaging keeps your BDT team close for files, ideas, and briefs.',
  },
];

export function ServicePreview() {
  return (
    <section
      id="service-preview"
      className="connect-section relative mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-16 sm:px-10 sm:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute -left-20 top-24 size-64 rounded-full border border-metal-border/10 bg-metal-rose/[0.025] blur-[1px]" />
      <div className="relative grid gap-8 sm:gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div className="lg:sticky lg:top-28 lg:pr-8">
          <div className="font-body text-caption uppercase tracking-label text-metal-rose">
            Service preview
          </div>
          <h2 className="mt-4 max-w-xl font-display text-[2.15rem] leading-[1.02] text-ink-primary sm:text-display-xl lg:text-[4rem]">
            What BDT Connect will handle.
          </h2>
          <p className="mt-4 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-5 sm:text-body-lg">
            One Premium plan gives your business a clear monthly set of creative,
            social, website, reporting, and messaging support.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {services.map((service, index) => (
            <Card
              key={service.title}
              hover
              className={
                'service-visual-card group min-h-0 p-6 sm:min-h-[16rem] sm:p-7 ' +
                (index === services.length - 1 ? 'sm:col-span-2 sm:min-h-0 sm:grid sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6' : '')
              }
            >
              <div className="service-icon-frame transition-[transform,border-color,box-shadow] duration-300 ease-[var(--bdt-ease-base)] group-hover:-translate-y-1 group-hover:border-metal-rose/60 group-hover:shadow-glow">
                <ServiceIcon name={service.icon} />
              </div>
              <div className={index === services.length - 1 ? 'mt-5 sm:mt-0' : 'mt-6 sm:mt-8'}>
                <CardEyebrow>{service.eyebrow}</CardEyebrow>
                <CardTitle>{service.title}</CardTitle>
                <CardBody>{service.body}</CardBody>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
