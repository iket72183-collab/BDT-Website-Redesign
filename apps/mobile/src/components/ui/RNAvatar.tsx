import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, typography } from '@/styles/appTokens';

export interface RNAvatarProps {
  /** Full name; we render the initials. Use "—" for unknown. */
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Wraps avatar in a glowing rose-gold ring (used for selected/featured). */
  gold?: boolean;
  style?: ViewStyle;
}

const SIZE = { sm: 28, md: 40, lg: 56, xl: 80 } as const;
const FONT = { sm: 11, md: 14, lg: 20, xl: 28 } as const;

/** Initials-based avatar — no image dependency. Background is a subtle
 *  dark-on-dark gradient so it sits well on any surface. */
export function RNAvatar({ name, size = 'md', gold = false, style }: RNAvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  const px = SIZE[size];
  const ringPad = gold ? 2 : 0;

  return (
    <View
      style={[
        { width: px + ringPad * 2, height: px + ringPad * 2, borderRadius: (px + ringPad * 2) / 2 },
        gold && styles.ring,
        style,
      ]}
    >
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          margin: ringPad,
          backgroundColor: palette.bg.raised,
        }}
      >
        <LinearGradient
          colors={['rgba(201,168,130,0.18)', 'rgba(22,22,22,0.4)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={{
            fontFamily: typography.family.displayBold,
            fontSize: FONT[size],
            color: palette.metal.rose,
            letterSpacing: 0.5,
          }}
        >
          {initials || '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    padding: 2,
    backgroundColor: palette.metal.rose,
    shadowColor: palette.metal.rose,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 6,
  },
});
