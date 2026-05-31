import { forwardRef, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { palette, radius, space, typography, motion } from '@/styles/appTokens';

export interface RNInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

/**
 * Floating-label input. Label slides up on focus or when the field has a value.
 * Focus state shows a rose-gold border + soft glow shadow.
 */
export const RNInput = forwardRef<TextInput, RNInputProps>(function RNInput(
  { label, hint, invalid, leftIcon, rightIcon, containerStyle, onFocus, onBlur, value, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const float = useRef(new Animated.Value(value ? 1 : 0)).current;

  const animateFloat = (to: number) =>
    Animated.timing(float, {
      toValue: to,
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easeBezier),
      useNativeDriver: false,
    }).start();

  const labelStyle = {
    top: float.interpolate({ inputRange: [0, 1], outputRange: [18, 6] }),
    fontSize: float.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
    color: invalid
      ? palette.status.danger
      : focused
        ? palette.metal.rose
        : palette.ink.muted,
  };

  return (
    <View style={containerStyle}>
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          invalid && styles.boxInvalid,
        ]}
      >
        {leftIcon && <View style={styles.left}>{leftIcon}</View>}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.Text
            style={[
              styles.label,
              labelStyle,
              { letterSpacing: typography.tracking.label, textTransform: 'uppercase' },
            ]}
          >
            {label}
          </Animated.Text>
          <TextInput
            ref={ref}
            value={value}
            placeholderTextColor={palette.ink.subtle}
            selectionColor={palette.metal.rose}
            style={styles.input}
            onFocus={(e) => {
              setFocused(true);
              animateFloat(1);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              if (!value) animateFloat(0);
              onBlur?.(e);
            }}
            {...rest}
          />
        </View>
        {rightIcon && <View style={styles.right}>{rightIcon}</View>}
      </View>
      {hint && (
        <Text style={[styles.hint, invalid && { color: palette.status.danger }]}>{hint}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 60,
    borderRadius: radius.lg,
    backgroundColor: palette.bg.inset,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.35)',
    paddingHorizontal: space[4],
  },
  boxFocused: {
    borderColor: palette.metal.rose,
    shadowColor: palette.metal.rose,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 6,
  },
  boxInvalid: {
    borderColor: palette.status.danger,
  },
  label: {
    position: 'absolute',
    left: 0,
    fontFamily: typography.family.bodyMedium,
  },
  input: {
    color: palette.ink.primary,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    paddingTop: 22,
    paddingBottom: 8,
  },
  left: { justifyContent: 'center', paddingRight: space[3] },
  right: { justifyContent: 'center', paddingLeft: space[3] },
  hint: {
    marginTop: space[2],
    marginLeft: space[1],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.subtle,
  },
});
