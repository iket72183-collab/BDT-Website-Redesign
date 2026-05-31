import type { Config } from 'tailwindcss';
import { colors, typography, spacing, radius, shadow } from './styles/tokens.js';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Tiny-phone breakpoint (iPhone SE etc.) — lets us hide long copy
        // below 400px without affecting standard mobile (375px is still small).
        xs: '400px',
      },
      colors: {
        bg: colors.bg,
        metal: colors.metal,
        ink: colors.text, // `text-ink-primary`, `text-ink-muted`, …
        status: colors.status,
      },
      fontFamily: {
        display: ['var(--bdt-font-display)'],
        body: ['var(--bdt-font-body)'],
        sans: ['var(--bdt-font-body)'],
      },
      fontSize: typography.size as unknown as NonNullable<NonNullable<Config['theme']>['fontSize']>,
      spacing,
      borderRadius: radius,
      boxShadow: {
        card: shadow.card,
        'card-hover': shadow.cardHover,
        glow: shadow.glow,
        'glow-strong': shadow.glowStrong,
        frame: shadow.frame,
      },
      letterSpacing: {
        label: '0.18em',
        wide: '0.15em',
      },
      backgroundImage: {
        // Radial vignette that warms the page background.
        'bg-vignette':
          'radial-gradient(ellipse at top, rgba(201, 168, 130, 0.06), transparent 60%)',
        // The shimmer gradient used by primary CTAs. Animated via
        // `animate-shimmer` (defined below) sliding background-position.
        'metal-shimmer':
          'linear-gradient(110deg, #8B7355 0%, #C9A882 25%, #E8D4A8 45%, #D4AF7A 55%, #C9A882 75%, #8B7355 100%)',
        // Static metal — used for borders, dividers, the logo wordmark.
        'metal-flat':
          'linear-gradient(180deg, #D4AF7A 0%, #C9A882 50%, #8B7355 100%)',
      },
      backgroundSize: {
        shimmer: '200% 100%',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 50%' },
          '100%': { backgroundPosition: '-200% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: `0 0 12px ${colors.metal.glow}` },
          '50%':      { boxShadow: `0 0 24px ${colors.metal.rose}55, 0 0 48px ${colors.metal.rose}22` },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3.2s linear infinite',
        'glow-pulse': 'glow-pulse 3.6s ease-in-out infinite',
        'fade-up': 'fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
