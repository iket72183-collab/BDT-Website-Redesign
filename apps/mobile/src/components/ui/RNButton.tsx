import { useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { palette, radius, space, typography, motion } from '@/styles/appTokens';

export type RNButtonVariant = 'primary' | 'ghost' | 'danger' | 'text';
export type RNButtonSize = 'sm' | 'md' | 'lg';

export interface RNButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: RNButtonVariant;
  size?: RNButtonSize;
  /** Adds a light haptic on press. Default true for primary/danger. */
  haptic?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

/**
 * Primary = animated rose-gold gradient with dark text. Ghost = transparent
 * with gold hairline border. Danger = muted maroon. Text = bare link.
 * Press state always scales to 0.97 and (where appropriate) triggers haptics.
 */
export function RNButton({
  label,
  variant = 'primary',
  size = 'md',
  haptic,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  fullWidth,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: RNButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  // Continuous shimmer slide for the primary variant.
  if (variant === 'primary' && !disabled) {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: motion.duration.shimmer,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }

  const shouldHaptic = haptic ?? (variant === 'primary' || variant === 'danger');
  const isDisabled = disabled || loading;

  const press = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();

  const sizeStyle = SIZES[size];

  const content = (
    <View style={[styles.row, { gap: space[2] }]}>
      {leftIcon}
      <Text
        style={[
          styles.label,
          { fontSize: sizeStyle.fontSize, color: TEXT_COLOR[variant] },
          size === 'lg' && styles.labelLg,
        ]}
        numberOfLines={1}
      >
        {loading ? '…' : label}
      </Text>
      {rightIcon}
    </View>
  );

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={(e) => {
          press(0.97);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          press(1);
          onPressOut?.(e);
        }}
        onPress={(e) => {
          if (shouldHaptic) {
            Haptics.impactAsync(
              variant === 'danger'
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light,
            );
          }
          onPress?.(e);
        }}
        style={[styles.base, sizeStyle.box, isDisabled && styles.disabled]}
        {...rest}
      >
        {variant === 'primary' && (
          <>
            <LinearGradient
              colors={[
                palette.metal.border,
                palette.metal.rose,
                palette.metal.highlight,
                palette.metal.champagne,
                palette.metal.rose,
                palette.metal.border,
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.2, 0.5, 0.65, 0.85, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Sheen overlay — a subtle white sliding band on top of the gradient. */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    {
                      translateX: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, 400],
                      }),
                    },
                    { skewX: '-20deg' },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.22)',
                  'rgba(255,255,255,0)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ width: 120, height: '100%' }}
              />
            </Animated.View>
          </>
        )}
        {variant === 'ghost' && <View style={styles.ghostBorder} pointerEvents="none" />}
        {variant === 'danger' && <View style={styles.dangerBg} pointerEvents="none" />}
        {content}
      </Pressable>
    </Animated.View>
  );
}

const TEXT_COLOR: Record<RNButtonVariant, string> = {
  primary: palette.ink.onMetal,
  ghost: palette.metal.rose,
  danger: palette.ink.primary,
  text: palette.ink.muted,
};

const SIZES = {
  sm: {
    fontSize: typography.size.bodySM,
    box: { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.md },
  },
  md: {
    fontSize: typography.size.bodyMD,
    box: { paddingHorizontal: space[5], paddingVertical: space[3], borderRadius: radius.lg },
  },
  lg: {
    fontSize: typography.size.bodyMD,
    box: { paddingHorizontal: space[6], paddingVertical: space[4], borderRadius: radius.lg },
  },
} as const;

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: typography.family.bodySemibold,
    letterSpacing: typography.tracking.wide,
  } satisfies TextStyle,
  labelLg: {
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.label,
  },
  ghostBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: palette.metal.border,
    borderRadius: radius.lg,
  },
  dangerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 32, 32, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139, 32, 32, 0.5)',
    borderRadius: radius.lg,
  },
  disabled: { opacity: 0.5 },
});
