import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { SocialAccount } from '@bdt/shared-types';
import { RNBadge, RNButton, RNCard, RNEmptyState, Icon } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import {
  METHOD_LABEL,
  PLATFORM_ICON,
  PLATFORM_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from './socialMeta';

export function SocialAccountsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api<{ data: SocialAccount[] }>('/api/social-accounts'),
    select: (r) => r.data,
  });
  const accounts = data ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
          <Icon name="chevron-left" size="lg" color={palette.ink.primary} />
        </Pressable>
        <Text style={styles.title}>Connected Accounts</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.metal.rose} />
        </View>
      ) : accounts.length === 0 ? (
        <RNEmptyState
          icon="link"
          title="No accounts connected yet"
          body="Connect the social accounts you'd like BDT to manage on your behalf."
          action={
            <RNButton
              label="Connect Account"
              variant="primary"
              onPress={() => router.push('/(client)/requests/accounts/new' as never)}
            />
          }
        />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => <AccountCard account={item} />}
          ListFooterComponent={
            <RNButton
              label="Connect Account"
              variant="ghost"
              onPress={() => router.push('/(client)/requests/accounts/new' as never)}
              style={{ marginTop: space[4] }}
            />
          }
        />
      )}
    </View>
  );
}

function AccountCard({ account }: { account: SocialAccount }) {
  return (
    <Pressable onPress={() => router.push(`/(client)/requests/accounts/${account.id}` as never)}>
      <RNCard padding="md" style={styles.card}>
        <View style={styles.cardIcon}>
          <Icon name={PLATFORM_ICON[account.platform]} size="md" color={palette.metal.rose} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{PLATFORM_LABEL[account.platform]}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {account.handle ?? 'No handle added'} · {METHOD_LABEL[account.accessMethod]}
          </Text>
        </View>
        <RNBadge label={STATUS_LABEL[account.status]} tone={STATUS_TONE[account.status]} dot />
        <Icon name="chevron-right" size="sm" color={palette.ink.subtle} />
      </RNCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base, paddingTop: space[8] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    marginBottom: space[4],
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  list: { paddingHorizontal: space[5], paddingBottom: space[8], gap: space[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: space[1] },
  cardTitle: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
  cardMeta: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
