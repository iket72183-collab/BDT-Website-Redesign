/**
 * BDT Connect — design tokens (source of truth).
 *
 * Consumed by:
 *   - tailwind.config.ts  → exposed as Tailwind theme values
 *   - styles/tokens.css   → mirrored as CSS custom properties for arbitrary
 *                           CSS-in-JS, raw style attributes, and the mobile
 *                           app's future web build.
 *
 * Vibe: luxury hotel meets fintech. Matte black, brushed metals, warm
 * whites. No pure-white text, no cool grays, no flat saturated accents.
 */

export const colors = {
  // Surfaces — layered from deepest to lightest.
  bg: {
    base: '#0A0A0A',      // page background
    surface: '#111111',   // card surface
    raised: '#161616',    // elevated card / modal
    inset: '#080808',     // recessed wells / inputs
  },

  // Brand metals. `rose` is primary; `champagne` is the lighter shimmer
  // highlight inside the metallic gradient; `border` is the muted gold
  // used for thin static borders so they don't compete with content.
  metal: {
    rose: '#C9A882',
    champagne: '#D4AF7A',
    border: '#8B7355',
    deep: '#6B5640',     // darker rose for pressed states
    glow: '#C9A88240',   // 25% alpha rose — for box-shadow glows
  },

  // Text — warm-tinted, never #FFF.
  text: {
    primary: '#F5F0E8',   // warm white — body + headings
    muted: '#A89880',     // secondary / captions
    subtle: '#6B5F4F',    // tertiary / disabled
    onMetal: '#0A0A0A',   // text sitting on a metallic CTA
  },

  // Status — desaturated, brand-coherent. No bright reds/greens.
  status: {
    danger: '#8B2020',
    dangerSoft: '#8B202022',
    success: '#2D5A3D',
    successSoft: '#2D5A3D22',
    warning: '#A8761F',
  },
};

export const typography = {
  family: {
    display: '"Playfair Display", Georgia, serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  // Use these as Tailwind utility names: text-display-xl, text-body-md, etc.
  size: {
    'display-2xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
    'display-xl':  ['3.5rem', { lineHeight: '1.1',  letterSpacing: '-0.015em' }],
    'display-lg':  ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
    'display-md':  ['2rem',   { lineHeight: '1.2',  letterSpacing: '-0.005em' }],
    'body-lg':     ['1.125rem', { lineHeight: '1.6' }],
    'body-md':     ['1rem',     { lineHeight: '1.6' }],
    'body-sm':     ['0.875rem', { lineHeight: '1.55' }],
    'caption':     ['0.75rem',  { lineHeight: '1.5', letterSpacing: '0.03em' }],
    'label':       ['0.75rem',  { lineHeight: '1.2', letterSpacing: '0.18em' }], // ALL CAPS labels
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
};

// 8pt base — keeps spacing rhythmic.
export const spacing = {
  px: '1px',
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
  40: '10rem',
};

export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
};

export const shadow = {
  // Soft, never harsh. Black bg means we mostly *glow* rather than cast shadow.
  card: '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 24px rgba(0, 0, 0, 0.5)',
  cardHover:
    '0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px ' +
    colors.metal.border + '40',
  glow: `0 0 12px ${colors.metal.glow}`,
  glowStrong: `0 0 24px ${colors.metal.rose}55, 0 0 48px ${colors.metal.rose}22`,
  // Inset border using metal — looks like an etched gold frame.
  frame: `inset 0 0 0 1px ${colors.metal.border}80`,
};

// Animation timings. Slow + eased — luxury never moves abruptly.
export const motion = {
  duration: {
    fast: '160ms',
    base: '240ms',
    slow: '420ms',
    shimmer: '3.2s',
  },
  ease: {
    base: 'cubic-bezier(0.22, 1, 0.36, 1)',     // ease-out-quart-ish
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
};

export const tokens = { colors, typography, spacing, radius, shadow, motion };
export default tokens;
