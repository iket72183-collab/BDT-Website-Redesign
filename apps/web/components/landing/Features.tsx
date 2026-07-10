import { Card, CardEyebrow, CardTitle, CardBody } from '../ui/Card';

// Inline SVGs keep the icon set crisp, lightweight, and consistent with the
// zero icon-library approach used by the landing page.
const iconStroke = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function IconFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto grid size-16 place-items-center rounded-xl border border-metal-border/35 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,122,0.20),rgba(17,17,17,0.62)_58%,rgba(8,8,8,0.88))] shadow-glow transition-[border-color,box-shadow,transform] duration-300 ease-[var(--bdt-ease-base)] group-hover:-translate-y-0.5 group-hover:border-metal-rose/55 group-hover:shadow-glow-strong sm:size-[4.5rem]"
      aria-hidden
    >
      {children}
    </div>
  );
}

function DesignIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-11 sm:size-12" aria-hidden>
      <defs>
        <linearGradient id="design-sheet" x1="18" y1="10" x2="48" y2="52">
          <stop stopColor="#F5DFAE" />
          <stop offset="0.52" stopColor="#C9A882" />
          <stop offset="1" stopColor="#816646" />
        </linearGradient>
        <linearGradient id="design-accent" x1="14" y1="49" x2="54" y2="16">
          <stop stopColor="#64D3FF" />
          <stop offset="1" stopColor="#E8B7FF" />
        </linearGradient>
      </defs>
      <path
        d="M18 14h22l8 8v27a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z"
        fill="url(#design-sheet)"
        opacity="0.18"
      />
      <path
        d="M18 14h22l8 8v27a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z"
        stroke="url(#design-sheet)"
        strokeWidth="2.2"
        {...iconStroke}
      />
      <path d="M40 15v8h8" stroke="#EAD5AD" strokeWidth="2.2" {...iconStroke} />
      <path
        d="M20 42l11.5-11.5 7 7L48 28"
        stroke="url(#design-accent)"
        strokeWidth="3"
        {...iconStroke}
      />
      <path
        d="M23 22h10M23 28h5"
        stroke="#F5F0E8"
        strokeOpacity="0.72"
        strokeWidth="2"
        {...iconStroke}
      />
      <path d="M50 13l1.5 3.5L55 18l-3.5 1.5L50 23l-1.5-3.5L45 18l3.5-1.5L50 13z" fill="#F5DFAE" />
      <circle cx="17" cy="47" r="2.6" fill="#64D3FF" opacity="0.85" />
    </svg>
  );
}

function MaintainIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-11 sm:size-12" aria-hidden>
      <defs>
        <linearGradient id="maintain-window" x1="11" y1="15" x2="53" y2="51">
          <stop stopColor="#E8D4A8" />
          <stop offset="1" stopColor="#8B7355" />
        </linearGradient>
        <linearGradient id="maintain-accent" x1="22" y1="48" x2="48" y2="20">
          <stop stopColor="#58E1A8" />
          <stop offset="1" stopColor="#75B8FF" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="14"
        width="44"
        height="36"
        rx="6"
        fill="#111111"
        stroke="url(#maintain-window)"
        strokeWidth="2.2"
      />
      <path d="M11 25h42" stroke="#8B7355" strokeOpacity="0.72" strokeWidth="2" {...iconStroke} />
      <circle cx="18" cy="20" r="2" fill="#C9A882" />
      <circle cx="25" cy="20" r="2" fill="#75B8FF" opacity="0.8" />
      <path d="M20 39l7 7 16-18" stroke="url(#maintain-accent)" strokeWidth="4" {...iconStroke} />
      <path
        d="M42 17l5 5M48.5 16.5l-7 7"
        stroke="#F5F0E8"
        strokeOpacity="0.72"
        strokeWidth="2"
        {...iconStroke}
      />
      <path
        d="M17 31h13M17 36h8"
        stroke="#F5F0E8"
        strokeOpacity="0.48"
        strokeWidth="2"
        {...iconStroke}
      />
      <circle cx="49" cy="42" r="5" fill="#58E1A8" opacity="0.18" />
    </svg>
  );
}

function PromoteIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-11 sm:size-12" aria-hidden>
      <defs>
        <linearGradient id="promote-body" x1="12" y1="19" x2="50" y2="43">
          <stop stopColor="#F5DFAE" />
          <stop offset="0.48" stopColor="#D4AF7A" />
          <stop offset="1" stopColor="#A56CFF" />
        </linearGradient>
        <linearGradient id="promote-signal" x1="39" y1="13" x2="58" y2="31">
          <stop stopColor="#64D3FF" />
          <stop offset="1" stopColor="#F5DFAE" />
        </linearGradient>
      </defs>
      <path d="M14 31v9l9-1 20 10V22L23 32l-9-1z" fill="url(#promote-body)" opacity="0.22" />
      <path
        d="M14 31v9l9-1 20 10V22L23 32l-9-1z"
        stroke="url(#promote-body)"
        strokeWidth="2.3"
        {...iconStroke}
      />
      <path
        d="M23 39l3 10a4 4 0 0 0 7.6-2.4L31 41"
        stroke="#E8D4A8"
        strokeWidth="2.3"
        {...iconStroke}
      />
      <path d="M43 23v25" stroke="#F5F0E8" strokeOpacity="0.5" strokeWidth="2" {...iconStroke} />
      <path
        d="M49 24c4 2 6 5.2 6 9s-2 7-6 9"
        stroke="url(#promote-signal)"
        strokeWidth="2.5"
        {...iconStroke}
      />
      <path
        d="M52 16c6.5 3.3 10 9.5 10 17s-3.5 13.7-10 17"
        stroke="url(#promote-signal)"
        strokeOpacity="0.55"
        strokeWidth="2.2"
        {...iconStroke}
      />
      <path
        d="M10 47h5M13 51h11M31 15h4v13h-4zM23 20h4v8h-4z"
        stroke="#64D3FF"
        strokeOpacity="0.75"
        strokeWidth="2"
        {...iconStroke}
      />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-11 sm:size-12" aria-hidden>
      <defs>
        <linearGradient id="connect-bubble" x1="11" y1="14" x2="49" y2="49">
          <stop stopColor="#E8D4A8" />
          <stop offset="0.55" stopColor="#C9A882" />
          <stop offset="1" stopColor="#64D3FF" />
        </linearGradient>
        <linearGradient id="connect-node" x1="20" y1="19" x2="53" y2="46">
          <stop stopColor="#E8B7FF" />
          <stop offset="1" stopColor="#58E1A8" />
        </linearGradient>
      </defs>
      <path
        d="M14 18h29a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H30l-10 8v-8h-6a7 7 0 0 1-7-7V25a7 7 0 0 1 7-7z"
        fill="url(#connect-bubble)"
        opacity="0.18"
      />
      <path
        d="M14 18h29a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H30l-10 8v-8h-6a7 7 0 0 1-7-7V25a7 7 0 0 1 7-7z"
        stroke="url(#connect-bubble)"
        strokeWidth="2.3"
        {...iconStroke}
      />
      <circle cx="22" cy="31" r="4" fill="#F5DFAE" />
      <circle cx="34" cy="31" r="4" fill="#64D3FF" />
      <circle cx="46" cy="31" r="4" fill="#E8B7FF" />
      <path d="M26 31h4M38 31h4" stroke="url(#connect-node)" strokeWidth="2.2" {...iconStroke} />
      <path d="M42 13l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" fill="#58E1A8" opacity="0.9" />
      <path
        d="M28 44c4 3 9 3 14 0"
        stroke="#F5F0E8"
        strokeOpacity="0.55"
        strokeWidth="2"
        {...iconStroke}
      />
    </svg>
  );
}

const features = [
  {
    icon: <DesignIcon />,
    eyebrow: 'Design',
    title: 'Creative assets, ready to use',
    body: 'AI-generated flyers, promos, graphics, and social visuals shaped by your brand.',
  },
  {
    icon: <MaintainIcon />,
    eyebrow: 'Maintain',
    title: 'Website updates kept moving',
    body: 'Website updates and maintenance cover edits, fixes, and calendar updates.',
  },
  {
    icon: <PromoteIcon />,
    eyebrow: 'Promote',
    title: 'Social presence, delivered',
    body: 'Social media management covers posts, captions, scheduling, and engagement.',
  },
  {
    icon: <ConnectIcon />,
    eyebrow: 'Connect',
    title: 'Team access and reporting',
    body: 'Direct messaging to your BDT team plus a monthly performance report with social growth, website traffic, and insights.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="connect-section relative mx-auto w-full max-w-7xl scroll-mt-28 px-5 py-16 sm:px-10 sm:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-[48%] hidden h-px bg-gradient-to-r from-transparent via-metal-border/25 to-transparent lg:block" />
      <div className="mx-auto max-w-3xl text-center">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          What&apos;s on retainer
        </div>
        <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] sm:text-display-xl text-ink-primary">
          Four things, done right.
          <span className="block text-metal">Every month.</span>
        </h2>
      </div>

      <div className="relative mt-8 grid gap-4 sm:mt-16 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, index) => (
          <Card
            key={f.title}
            hover
            className={
              'service-visual-card group flex min-h-[23rem] flex-col justify-between overflow-hidden ' +
              (index % 2 === 1 ? 'lg:translate-y-8' : '')
            }
          >
            <IconFrame>{f.icon}</IconFrame>
            <div className="mt-10">
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
