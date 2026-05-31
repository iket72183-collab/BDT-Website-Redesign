import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { palette, radius, space, typography } from '@/styles/appTokens';

export type RNBadgeTone =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'paid'
  | 'refunded'
  | 'metal'
  | 'muted';

export interface RNBadgeProps {
  label: string;
  tone?: RNBadgeTone;
  /** Small filled dot before the label — useful for status rows. */
  dot?: boolean;
  style?: ViewStyle;
}

const TONES: Record<RNBadgeTone, { fg: string; bg: string; border: string }> = {
  confirmed: {
    fg: palette.metal.rose,
    bg: 'rgba(201, 168, 130, 0.10)',
    border: 'rgba(201, 168, 130, 0.45)',
  },
  pending: {
    fg: palette.ink.muted,
    bg: 'rgba(168, 152, 128, 0.10)',
    border: 'rgba(168, 152, 128, 0.35)',
  },
  cancelled: {
    fg: '#C46868',
    bg: 'rgba(139, 32, 32, 0.15)',
    border: 'rgba(139, 32, 32, 0.45)',
  },
  paid: {
    fg: '#6FB286',
    bg: 'rgba(45, 90, 61, 0.18)',
    border: 'rgba(45, 90, 61, 0.5)',
  },
  refunded: {
    fg: palette.status.warning,
    bg: 'rgba(168, 118, 31, 0.15)',
    border: 'rgba(168, 118, 31, 0.45)',
  },
  metal: {
    fg: palette.metal.rose,
    bg: 'rgba(201, 168, 130, 0.08)',
    border: 'rgba(139, 115, 85, 0.6)',
  },
  muted: {
    fg: palette.ink.muted,
    bg: 'rgba(107, 95, 79, 0.10)',
    border: 'rgba(107, 95, 79, 0.4)',
  },
};

export function RNBadge({ label, tone = 'metal', dot = false, style }: RNBadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.caption,
    letterSpacing: typography.tracking.label,
    textTransform: 'uppercase',
  },
});
