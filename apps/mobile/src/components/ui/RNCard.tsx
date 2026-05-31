import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { palette, radius, space, elevation } from '@/styles/appTokens';

export interface RNCardProps extends ViewProps {
  /** standard = glass card. metric = denser, used by RNStatCard. flat = no blur (perf-sensitive lists). */
  variant?: 'standard' | 'metric' | 'flat';
  /** Adds the etched-gold inset border for premium / featured surfaces. */
  framed?: boolean;
  padding?: keyof typeof PAD;
  style?: ViewStyle;
}

const PAD = {
  none: 0,
  sm: space[3],
  md: space[5],
  lg: space[6],
} as const;

/**
 * Glass card. Uses BlurView on iOS where the effect actually composites
 * against live content; on Android we fall back to a tinted solid surface
 * because BlurView there has cost without much benefit on a dark page.
 */
export function RNCard({
  variant = 'standard',
  framed = false,
  padding = 'md',
  style,
  children,
  ...rest
}: RNCardProps) {
  const Container = variant !== 'flat' && Platform.OS === 'ios' ? BlurView : View;
  const blurProps =
    Container === BlurView ? ({ intensity: 18, tint: 'dark' } as const) : {};

  return (
    <View
      style={[
        styles.outer,
        elevation.card,
        framed && styles.framed,
        { padding: PAD[padding] },
        variant === 'metric' && styles.metric,
        style,
      ]}
      {...rest}
    >
      {/* Underlay gradient — gives the glass card a slightly warmer top edge
          even when BlurView is unavailable. */}
      <View pointerEvents="none" style={styles.underlay} />
      <Container style={StyleSheet.absoluteFill} {...blurProps} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    backgroundColor: palette.bg.glass,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.25)',
  },
  metric: {
    borderRadius: radius.lg,
    padding: space[4],
  },
  framed: {
    borderColor: 'rgba(139, 115, 85, 0.55)',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,22,22,0.55)',
  },
  content: {
    position: 'relative',
  },
});
