import { Card, CardBody, CardEyebrow, CardTitle } from '../ui/Card';

const services = [
  {
    eyebrow: 'Web presence',
    title: 'Website setup or redesign',
    body:
      'A polished, mobile-first site that explains what you do, earns trust, and gives customers a clear next step.',
  },
  {
    eyebrow: 'Brand polish',
    title: 'Social profile cleanup',
    body:
      'Sharper bios, links, profile visuals, highlights, and content direction so your public profiles feel current.',
  },
  {
    eyebrow: 'Ongoing support',
    title: 'Monthly content help',
    body:
      'Planned updates, light campaign support, and practical content assistance so the business does not sit still online.',
  },
  {
    eyebrow: 'Visibility',
    title: 'Reporting and next steps',
    body:
      'Simple monthly reporting, progress notes, and clear recommendations instead of scattered vendor updates.',
  },
  {
    eyebrow: 'Communication',
    title: 'Direct team messaging',
    body:
      'Use the BDT Connect app to send requests, review deliverables, and keep the work moving in one thread.',
  },
  {
    eyebrow: 'Operations',
    title: 'A cleaner digital system',
    body:
      'Bring website, social, support, and recurring maintenance into one retainer instead of five disconnected tools.',
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
            Before subscription checkout goes live, this is the shape of the service:
            a practical digital support layer for businesses that need their website,
            social presence, and monthly updates handled with care.
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
