import { Card, CardBody, CardEyebrow, CardTitle } from '../ui/Card';

const services = [
  {
    eyebrow: 'Promote',
    title: 'Social Media Management',
    body:
      '12 requests per month included for posts, captions, scheduling, and engagement.',
  },
  {
    eyebrow: 'Maintain',
    title: 'Website Updates',
    body:
      '4 website update requests per month included for edits, fixes, maintenance, and calendar updates.',
  },
  {
    eyebrow: 'Create',
    title: 'AI Creative Assets',
    body:
      '4 AI-generated creative assets per month included for flyers, promos, graphics, and social visuals.',
  },
  {
    eyebrow: 'Connect',
    title: 'Direct Messaging',
    body:
      'Unlimited direct messaging keeps your BDT team close for files, ideas, and briefs.',
  },
  {
    eyebrow: 'Report',
    title: 'Performance Reporting',
    body:
      '1 monthly performance report included with social growth, website traffic, and insights.',
  },
  {
    eyebrow: 'Need more',
    title: 'Extra Requests',
    body:
      'Additional requests are available at $25 each whenever your month needs more support.',
  },
];

export function ServicePreview() {
  return (
    <section
      id="service-preview"
      className="relative mx-auto w-full max-w-7xl px-5 py-14 sm:px-10 sm:py-32"
    >
      <div className="grid gap-7 sm:gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <div className="font-body text-caption uppercase tracking-label text-metal-rose">
            Service preview
          </div>
          <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] text-ink-primary sm:text-display-xl">
            What BDT Connect will handle.
          </h2>
          <p className="mt-4 font-body text-body-sm leading-relaxed text-ink-muted sm:mt-5 sm:text-body-lg">
            One Premium plan gives your business a clear monthly set of creative,
            social, website, reporting, and messaging support.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {services.map((service) => (
            <Card key={service.title} hover>
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
