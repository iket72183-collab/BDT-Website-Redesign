/**
 * BDT Connect — React Native design tokens.
 *
 * Mirror of apps/web/styles/tokens.js, translated to RN-native units:
 *   - spacing/radius in numbers (RN doesn't accept "1rem" / "8px" strings)
 *   - typography sizes in numbers (pt-equivalent)
 *   - shadows split into iOS (shadow*) and Android (elevation) shapes
 *
 * Source of truth for visual decisions in the mobile app. If you find
 * yourself writing a hex value inside a component, add it here first.
 */

export const palette = {
  bg: {
    base: '#0A0A0A',
    surface: '#111111',
    raised: '#161616',
    inset: '#080808',
    // Frosted-glass overlay color — used as a tinted bg under blur effects.
    glass: 'rgba(22, 22, 22, 0.72)',
  },
  metal: {
    rose: '#C9A882',
    champagne: '#D4AF7A',
    highlight: '#E8D4A8',   // top stop of gradient — looks like a metal sheen
    border: '#8B7355',
    deep: '#6B5640',
    glow: 'rgba(201, 168, 130, 0.25)',
    glowStrong: 'rgba(201, 168, 130, 0.45)',
  },
  ink: {
    primary: '#F5F0E8',
    muted: '#A89880',
    subtle: '#6B5F4F',
    onMetal: '#0A0A0A',
  },
  status: {
    confirmed: '#C9A882',           // gold == confirmed (per brief)
    pending: '#A89880',             // muted
    cancelled: '#8B2020',
    paid: '#2D5A3D',
    refunded: '#A8761F',
    danger: '#8B2020',
    success: '#2D5A3D',
    warning: '#A8761F',
  },
} as const;

export const typography = {
  family: {
    display: 'PlayfairDisplay_600SemiBold',
    displayBold: 'PlayfairDisplay_700Bold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemibold: 'Inter_600SemiBold',
  },
  // RN uses raw numbers for fontSize / lineHeight (in pt).
  size: {
    displayXL: 36,
    displayLG: 30,
    displayMD: 24,
    displaySM: 20,
    bodyLG: 17,
    bodyMD: 15,
    bodySM: 13,
    caption: 11,
    label: 11,
  },
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    base: 1.5,
    relaxed: 1.6,
  },
  // RN's `letterSpacing` is in pt, not em. At ~11pt, 0.18em ≈ 2pt.
  tracking: {
    label: 2,
    wide: 1.6,
    base: 0,
    tight: -0.3,
  },
} as const;

// 4pt base — matches RN's native rhythm (which tends to use 4 not 8).
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 999,
} as const;

/**
 * Elevation tokens. iOS gets shadow*; Android gets elevation. Apply both —
 * platform that doesn't use one ignores it.
 */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  cardHover: {
    shadowColor: palette.metal.rose,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 10,
  },
  glow: {
    shadowColor: palette.metal.rose,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const motion = {
  duration: {
    fast: 160,
    base: 240,
    slow: 420,
    shimmer: 3200,
  },
  // The custom ease from the web side: ease-out-quart-ish.
  // RN's Easing.bezier matches a cubic-bezier curve.
  easeBezier: [0.22, 1, 0.36, 1] as const,
} as const;

/** Convenience: status → token color used by Badge & ListItem. */
export const statusColor = palette.status;

export const tokens = {
  palette,
  typography,
  space,
  radius,
  elevation,
  motion,
} as const;

export default tokens;
