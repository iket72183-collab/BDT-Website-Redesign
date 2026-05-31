import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RNBadge, RNButton, RNCard } from '@/components/ui';
import { api } from '@/api/client';
import { palette, space, typography } from '@/styles/appTokens';

interface Message {
  id: string;
  subject: string | null;
  body: string;
  status: 'unread' | 'read' | 'archived';
  sentAt: string;
}

/**
 * Read-only history of everything this client has sent. The agency reads
 * inbound on email; "status" tracks BDT's view (unread until they mark it
 * read in the admin surface — not the client's view).
 */
export function MessageHistoryScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['messages'],
    queryFn: () =>
      api<{ data: Message[]; meta?: { total: number } }>('/api/messages?limit=50'),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.metal.rose} />
      </View>
    );
  }

  const messages = data?.data ?? [];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Message History</Text>

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>Tap the button below to reach out.</Text>
          <RNButton
            label="Send a Message"
            variant="primary"
            onPress={() => router.push('/(client)/messages' as never)}
          />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <RNCard padding="md" style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.subject} numberOfLines={1}>
                  {item.subject ?? 'No subject'}
                </Text>
                <RNBadge
                  label={item.status === 'unread' ? 'New' : 'Seen'}
                  tone={item.status === 'unread' ? 'confirmed' : 'pending'}
                  dot
                />
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.date}>{formatDate(item.sentAt)}</Text>
            </RNCard>
          )}
        />
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base, paddingTop: space[8] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
    paddingHorizontal: space[5],
    marginBottom: space[4],
  },
  list: { paddingHorizontal: space[5], paddingBottom: space[8], gap: space[3] },
  row: { gap: space[2] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  subject: {
    flex: 1,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
  preview: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  date: {
    fontFamily: typography.family.body,
    fontSize: typography.size.caption,
    color: palette.ink.subtle,
  },
  center: { flex: 1, backgroundColor: palette.bg.base, justifyContent: 'center', alignItems: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[6],
    gap: space[3],
  },
  emptyTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  emptyBody: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    marginBottom: space[3],
  },
});
