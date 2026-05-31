import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, space, typography } from '@/styles/appTokens';

export interface RNListItemAction {
  label: string;
  tone?: 'confirm' | 'cancel' | 'neutral';
  onPress: () => void;
}

export interface RNListItemProps {
  /** Big left thing — usually a time string or avatar. */
  leading?: React.ReactNode;
  /** Primary line (client name, transaction title). */
  title: string;
  /** Secondary line (service, staff, meta). */
  subtitle?: string;
  /** Right side — typically a price or status badge. */
  trailing?: React.ReactNode;
  /** Optional swipe-revealed actions. Hint shown in note (not implemented). */
  actions?: RNListItemAction[];
  onPress?: () => void;
}

/**
 * One row in a list. Press scales to 0.98 with a subtle gold border flash.
 * Swipe actions stub: prop is here so screens can declare intent — wire to
 * react-native-gesture-handler's Swipeable in a follow-up.
 */
export function RNListItem({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
}: RNListItemProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;

  const animate = (s: number, o: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.timing(borderOpacity, { toValue: o, duration: 160, useNativeDriver: false }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.98, 1)}
        onPressOut={() => animate(1, 0)}
        style={styles.row}
      >
        <Animated.View
          style={[styles.borderOverlay, { opacity: borderOpacity }]}
          pointerEvents="none"
        />
        {leading && <View style={styles.leading}>{leading}</View>}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[4],
    paddingHorizontal: space[2],
    gap: space[4],
    borderRadius: radius.lg,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: palette.metal.rose,
    borderRadius: radius.lg,
  },
  leading: { minWidth: 56 },
  center: { flex: 1, minWidth: 0 },
  trailing: { alignItems: 'flex-end', gap: space[1] },
  title: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
});
