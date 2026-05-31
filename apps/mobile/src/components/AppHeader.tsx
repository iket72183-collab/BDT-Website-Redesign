import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, space, typography } from '@/styles/appTokens';
import { Icon } from './ui/icons';
import { RNAvatar } from './ui/RNAvatar';

export interface AppHeaderProps {
  /** Optional left wordmark — if omitted, shows page title only. */
  brand?: { name: string; tagline?: string };
  /** Page title (replaces brand when present). */
  title?: string;
  /** Initials for the right avatar; tap → profile / sheet. */
  user?: { name: string };
  unreadCount?: number;
  onNotificationsPress?: () => void;
  onAvatarPress?: () => void;
}

export function AppHeader({
  brand,
  title,
  user,
  unreadCount = 0,
  onNotificationsPress,
  onAvatarPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space[2] }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : brand ? (
            <View>
              <Text style={styles.brand}>{brand.name}</Text>
              {brand.tagline && <Text style={styles.tagline}>{brand.tagline}</Text>}
            </View>
          ) : null}
        </View>

        <View style={styles.right}>
          <Pressable
            onPress={onNotificationsPress}
            hitSlop={8}
            style={styles.bellBtn}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Icon name="bell" color={palette.ink.muted} />
            {unreadCount > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          {user && (
            <Pressable onPress={onAvatarPress} accessibilityRole="button">
              <RNAvatar name={user.name} size="sm" gold />
            </Pressable>
          )}
        </View>
      </View>
      {/* Hairline divider — opacity-shifted gradient, never a hard rule. */}
      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    backgroundColor: palette.bg.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  brand: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displaySM,
    color: palette.metal.rose,
    letterSpacing: typography.tracking.tight,
  },
  tagline: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.caption,
    letterSpacing: typography.tracking.label,
    textTransform: 'uppercase',
    color: palette.ink.muted,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,22,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.3)',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.metal.rose,
  },
  dotText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: 9,
    color: palette.ink.onMetal,
  },
  hairline: {
    marginTop: space[3],
    height: 1,
    backgroundColor: 'rgba(139, 115, 85, 0.18)',
  },
});
