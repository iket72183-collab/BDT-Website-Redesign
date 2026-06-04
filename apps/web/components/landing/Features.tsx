import { Card, CardEyebrow, CardTitle, CardBody } from '../ui/Card';

// Inline SVGs so the page has zero icon-library dependency. All icons share
// the same stroke + scale so they read as a coherent set.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function GlobeIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" {...stroke}>
      <circle cx="16" cy="16" r="11" />
      <path d="M5 16h22M16 5c4 3 4 19 0 22M16 5c-4 3-4 19 0 22" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" {...stroke}>
      <path d="M16 4l10 4v8c0 6-4.4 10.4-10 12-5.6-1.6-10-6-10-12V8l10-4z" />
      <path d="M11 16l3.5 3.5L21 13" />
    </svg>
  );
}
function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" {...stroke}>
      <path d="M6 13v6l16 6V7L6 13z" />
      <path d="M6 13H4a2 2 0 0 0 0 4h2M10 19l1 5a2 2 0 0 0 4-.5L14 20" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" {...stroke}>
      <rect x="5" y="6" width="22" height="20" rx="3" />
      <path d="M5 18h6l2 3h6l2-3h6" />
      <path d="M16 11v4M13 13h6" />
    </svg>
  );
}

const features = [
  {
    icon: <GlobeIcon />,
    eyebrow: 'Design',
    title: 'Creative assets, ready to use',
    body:
      '4 AI-generated flyers, promos, graphics, or social visuals every month, shaped by your brand.',
  },
  {
    icon: <ShieldIcon />,
    eyebrow: 'Maintain',
    title: 'Website updates kept moving',
    body:
      '4 monthly website update requests cover edits, fixes, maintenance, and calendar updates.',
  },
  {
    icon: <MegaphoneIcon />,
    eyebrow: 'Promote',
    title: 'Social presence, delivered',
    body:
      '12 social media requests per month for posts, captions, scheduling, and engagement.',
  },
  {
    icon: <InboxIcon />,
    eyebrow: 'Connect',
    title: 'Team access and reporting',
    body:
      'Unlimited direct messaging plus 1 monthly performance report with social growth, website traffic, and insights.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-5 py-14 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          What's on retainer
        </div>
        <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] sm:text-display-xl text-ink-primary">
          Four things, done right.
          <span className="block text-metal">Every month.</span>
        </h2>
      </div>

      <div className="mt-8 grid gap-4 sm:mt-16 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title} hover className="flex flex-col">
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-lg
                         bg-metal-rose/[0.08] text-metal-rose ring-1 ring-metal-border/40"
            >
              {f.icon}
            </div>
            <div className="mt-6">
              <CardEyebrow>{f.eyebrow}</CardEyebrow>
              <CardTitle>{f.title}</CardTitle>
              <CardBody>{f.body}</CardBody>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
