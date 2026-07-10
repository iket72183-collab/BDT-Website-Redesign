import { Card, CardBody, CardEyebrow, CardTitle } from '../ui/Card';

const services = [
  {
    eyebrow: 'Create',
    title: 'AI Creative Assets',
    body:
      'Flyers, promos, graphics, and social visuals shaped for your brand.',
  },
  {
    eyebrow: 'Promote',
    title: 'Social Media Management',
    body:
      'Posts, captions, scheduling, and engagement support for your social presence.',
  },
  {
    eyebrow: 'Maintain',
    title: 'Website Updates',
    body:
      'Edits, fixes, maintenance, and calendar updates to keep your site current.',
  },
  {
    eyebrow: 'Report',
    title: 'Performance Reporting',
    body:
      'Monthly reporting on social growth, website traffic, and useful insights.',
  },
  {
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
      className="connect-section relative mx-auto w-full max-w-7xl scroll-mt-28 px-8 py-16 sm:px-10 sm:py-28"
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
                'service-visual-card group min-h-0 p-6 sm:p-7 ' +
                (index === services.length - 1 ? 'sm:col-span-2' : '')
              }
            >
              <CardEyebrow>{service.eyebrow}</CardEyebrow>
              <CardTitle>{service.title}</CardTitle>
              <CardBody>{service.body}</CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
