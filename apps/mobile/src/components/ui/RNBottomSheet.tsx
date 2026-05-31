import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette, radius, space, typography, motion } from '@/styles/appTokens';

export interface RNBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** As a fraction of screen height. Default 0.55. */
  snap?: number;
}

/**
 * Minimal slide-up modal. Backdrop fades, sheet slides from the bottom.
 * For production gesture-driven sheets, swap to @gorhom/bottom-sheet —
 * this implementation is dependency-free for the scaffold.
 */
export function RNBottomSheet({
  visible,
  onClose,
  title,
  children,
  snap = 0.55,
}: RNBottomSheetProps) {
  const screenH = Dimensions.get('window').height;
  const sheetH = screenH * snap;

  const translateY = useRef(new Animated.Value(sheetH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: motion.duration.base,
          easing: Easing.bezier(...motion.easeBezier),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: motion.duration.base,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetH,
          duration: motion.duration.fast,
          easing: Easing.bezier(...motion.easeBezier),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: motion.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, sheetH, translateY, backdrop]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetH, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.bg.raised,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderTopWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.45)',
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[8],
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(168, 152, 128, 0.4)',
    marginBottom: space[4],
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
    marginBottom: space[4],
  },
});
