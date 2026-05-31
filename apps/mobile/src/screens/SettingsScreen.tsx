import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  RNButton,
  RNCard,
  RNListItem,
  RNSectionHeader,
  Icon,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Account-level settings. Plan management has its own tab; this screen owns
 * notifications, message history, and sign-out.
 */
export function SettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <RNCard>
          <Text style={styles.eyebrow}>SIGNED IN AS</Text>
          <Text style={styles.name}>
            {user ? `${user.firstName} ${user.lastName}` : '—'}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </RNCard>

        <RNSectionHeader title="Messages" />
        <RNCard padding="sm">
          <RNListItem
            title="Message history"
            subtitle="Everything you've sent the BDT team"
            trailing={<Icon name="chevron-right" color={palette.ink.subtle} />}
            onPress={() => router.push('/(client)/messages/history' as never)}
          />
        </RNCard>

        <RNSectionHeader title="Notifications" />
        <RNCard padding="sm">
          <RNListItem
            title="Push & Email"
            subtitle="Manage alerts and devices"
            trailing={<Icon name="chevron-right" color={palette.ink.subtle} />}
            onPress={() => router.push('/(client)/settings/notifications' as never)}
          />
        </RNCard>

        <View style={{ marginTop: space[6] }}>
          <RNButton label="Sign Out" variant="danger" onPress={handleSignOut} />
        </View>

        <View style={{ height: space[12] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[8],
    paddingBottom: space[8],
    gap: space[4],
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  eyebrow: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  name: {
    marginTop: space[2],
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  email: {
    marginTop: space[1],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
});
