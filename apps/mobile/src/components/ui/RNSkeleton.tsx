import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '@/styles/appTokens';

export interface RNSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Dark shimmering placeholder. Use while data loads — pages should never
 * pop blank → full; always render skeletons of the same rough shape first.
 */
export function RNSkeleton({
  width = '100%',
  height = 16,
  borderRadius: r = radius.sm,
  style,
}: RNSkeletonProps) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [x]);

  return (
    <View
      style={[
        { width, height, borderRadius: r, backgroundColor: '#1A1A1A', overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-200, 400] }) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#1A1A1A', '#252525', '#1A1A1A']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 200, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}
