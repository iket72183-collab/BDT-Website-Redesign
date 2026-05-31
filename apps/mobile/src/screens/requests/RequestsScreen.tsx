import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ClientRequest, RequestUsage } from '@bdt/shared-types';
import { RNBadge, RNButton, RNCard, RNEmptyState, Icon } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import {
  STATUS_LABEL,
  STATUS_TONE,
  TYPE_ICON,
  TYPE_LABEL,
  formatRelative,
  formatResetDate,
} from './requestMeta';

interface ListPage {
  data: { requests: ClientRequest[]; total: number; page: number; hasMore: boolean };
}

export function RequestsScreen() {
  const usage = useQuery({
    queryKey: ['requests', 'usage'],
    queryFn: () => api<{ data: RequestUsage }>('/api/requests/usage'),
    select: (r) => r.data,
  });

  const list = useInfiniteQuery({
    queryKey: ['requests', 'list'],
    queryFn: ({ pageParam }) =>
      api<ListPage>(`/api/requests?page=${pageParam}&limit=20`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.hasMore ? last.data.page + 1 : undefined),
  });

  const requests = list.data?.pages.flatMap((p) => p.data.requests) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New request"
          onPress={() => router.push('/(client)/requests/new' as never)}
          style={styles.newBtn}
        >
          <Icon name="plus" size="md" color={palette.metal.rose} />
          <Text style={styles.newBtnLabel}>NEW</Text>
        </Pressable>
      </View>

      {usage.data && <UsageBar usage={usage.data} />}

      {list.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.metal.rose} />
        </View>
      ) : requests.length === 0 ? (
        <RNEmptyState
          icon="clipboard"
          title="No requests yet"
          body="Submit your first request and the BDT team will take it from there."
          action={
            <RNButton
              label="Submit your first request"
              variant="primary"
              onPress={() => router.push('/(client)/requests/new' as never)}
            />
          }
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={list.refetch}
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
          }}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator color={palette.metal.rose} style={{ paddingVertical: space[4] }} />
            ) : null
          }
          renderItem={({ item }) => <RequestCard request={item} />}
        />
      )}
    </View>
  );
}

function UsageBar({ usage }: { usage: RequestUsage }) {
  const pct = usage.limit > 0 ? Math.min(1, usage.used / usage.limit) : 0;
  return (
    <View style={styles.usageWrap}>
      <Text style={styles.usageText}>
        {usage.used} of {usage.limit} requests used this month
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.resetText}>Resets {formatResetDate(usage.resetsAt)}</Text>
    </View>
  );
}

function RequestCard({ request }: { request: ClientRequest }) {
  return (
    <Pressable onPress={() => router.push(`/(client)/requests/${request.id}` as never)}>
      <RNCard padding="md" style={styles.card}>
        <View style={styles.cardIcon}>
          <Icon name={TYPE_ICON[request.type]} size="md" color={palette.metal.rose} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {request.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {TYPE_LABEL[request.type]} · {formatRelative(request.createdAt)}
          </Text>
        </View>
        <RNBadge label={STATUS_LABEL[request.status]} tone={STATUS_TONE[request.status]} dot />
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
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  newBtnLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  usageWrap: { paddingHorizontal: space[5], marginBottom: space[5], gap: space[2] },
  usageText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: palette.bg.raised,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: radius.full, backgroundColor: palette.metal.rose },
  resetText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.caption,
    color: palette.ink.subtle,
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
