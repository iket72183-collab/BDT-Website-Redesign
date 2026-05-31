import { Feather } from '@expo/vector-icons';
import { palette } from '@/styles/appTokens';

// Thin-line icon set. Centralized so every screen uses the same stroke
// weight + base color. Feather glyphs are 1.5px stroke at 24 — never
// substitute filled or "Material" icons here.

export const ICON_SIZE = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export interface IconProps {
  name: keyof typeof Feather.glyphMap;
  size?: keyof typeof ICON_SIZE | number;
  color?: string;
}

export function Icon({ name, size = 'md', color = palette.ink.muted }: IconProps) {
  const px = typeof size === 'number' ? size : ICON_SIZE[size];
  return <Feather name={name} size={px} color={color} />;
}

// Tab-bar icon names, named here so AppNavigator + screens don't drift.
export const TAB_ICON = {
  Home: 'home',
  Bookings: 'calendar',
  Schedule: 'clock',
  Clients: 'users',
  Settings: 'sliders',
  Book: 'plus-circle',
  Today: 'sun',
  Profile: 'user',
} as const satisfies Record<string, keyof typeof Feather.glyphMap>;
