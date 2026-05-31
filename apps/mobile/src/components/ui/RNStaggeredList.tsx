import { Children, isValidElement, useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import { motion } from '@/styles/appTokens';

export interface RNStaggeredListProps {
  children: React.ReactNode;
  /** Delay per child, ms. */
  step?: number;
  style?: ViewStyle;
}

/**
 * Wrap any list of children to get a 50ms-staggered fade + slide-up entrance.
 * Per the motion rules — measured, never bouncy.
 */
export function RNStaggeredList({ children, step = 50, style }: RNStaggeredListProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={style}>
      {items.map((child, i) => (
        <StaggerItem key={(child as { key?: React.Key }).key ?? i} delay={i * step}>
          {child}
        </StaggerItem>
      ))}
    </View>
  );
}

function StaggerItem({ children, delay }: { children: React.ReactNode; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration.base,
        delay,
        easing: Easing.bezier(...motion.easeBezier),
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration: motion.duration.base,
        delay,
        easing: Easing.bezier(...motion.easeBezier),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, ty, delay]);

  return <Animated.View style={{ opacity, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}
