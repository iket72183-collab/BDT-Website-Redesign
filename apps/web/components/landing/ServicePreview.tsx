import { Card, CardBody, CardEyebrow, CardTitle } from '../ui/Card';

const services = [
  {
    eyebrow: 'Promote',
    title: 'Social Media Management',
    body:
      'We handle your posting, content, and engagement across all your platforms.',
  },
  {
    eyebrow: 'Maintain',
    title: 'Website Maintenance & Redesign',
    body:
      'Updates, fixes, and full redesigns handled for you, whenever you need it.',
  },
  {
    eyebrow: 'Create',
    title: 'AI Creative Assets',
    body:
      'Professional flyers, promos, and graphics created with AI tools by our team.',
  },
  {
    eyebrow: 'Connect',
    title: 'Unlimited Requests',
    body:
      'Send us files, ideas, or briefs anytime through the BDT Connect app.',
  },
  {
    eyebrow: 'Support',
    title: '24/7 AI Support',
    body:
      'Get instant answers any time of day or night.',
  },
  {
    eyebrow: 'Report',
    title: 'Monthly Performance Reports',
    body:
      'See how your social media and website are growing every month.',
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
            One Premium plan gives your business the website, social media, creative,
            support, and reporting services it needs online.
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
