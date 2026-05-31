import type { Config } from 'tailwindcss';

/**
 * Admin Tailwind theme. Mirrors the BDT Connect design tokens
 * (`apps/web/styles/tokens.js`) so this surface stays brand-consistent with
 * the marketing site and the mobile app. Keep the named colors in sync — if
 * you change a hex value here, update the source token first.
 *
 * Why not import from `apps/web/styles/tokens.js` directly: Tailwind reads
 * its config synchronously at build time, and importing across workspaces
 * adds tooling complexity for ~50 lines of static values. Cross-checked
 * manually until we extract a `packages/design-tokens` workspace.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0A0A',
          surface: '#111111',
          raised: '#161616',
          inset: '#080808',
        },
        metal: {
          rose: '#C9A882',
          champagne: '#D4AF7A',
          highlight: '#E8D4A8',
          border: '#8B7355',
          deep: '#6B5640',
        },
        ink: {
          primary: '#F5F0E8',
          muted: '#A89880',
          subtle: '#6B5F4F',
          onMetal: '#0A0A0A',
        },
        status: {
          danger:  '#8B2020',
          success: '#2D5A3D',
          warning: '#A8761F',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.18em',
      },
      boxShadow: {
        card:       '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 24px rgba(0, 0, 0, 0.5)',
        glow:       '0 0 12px rgba(201, 168, 130, 0.25)',
        glowStrong: '0 0 24px rgba(201, 168, 130, 0.35), 0 0 48px rgba(201, 168, 130, 0.15)',
        frame:      'inset 0 0 0 1px rgba(139, 115, 85, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
