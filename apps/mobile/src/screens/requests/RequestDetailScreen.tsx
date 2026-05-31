import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ClientRequest, RequestAttachment } from '@bdt/shared-types';
import { RNBadge, RNCard, Icon } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import { STATUS_LABEL, STATUS_TONE, TYPE_ICON, TYPE_LABEL, formatDateTime } from './requestMeta';

export function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Path of the attachment currently being signed — drives the chip spinner.
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  // The bucket is private, so we can't open a stored path directly. Ask the API
  // to sign it (server-side, service-role key) and open the short-lived URL.
  const openAttachment = async (attachment: RequestAttachment) => {
    if (openingPath) return; // a sign request is already in flight
    setOpeningPath(attachment.path);
    try {
      const res = await api<{ data: { signedUrl: string } }>(
        `/api/uploads/signed-url?path=${encodeURIComponent(attachment.path)}`,
      );
      await Linking.openURL(res.data.signedUrl);
    } catch {
      Alert.alert('Could not open file — try again');
    } finally {
      setOpeningPath(null);
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => api<{ data: ClientRequest }>(`/api/requests/${id}`),
    select: (r) => r.data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.metal.rose} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>This request could not be found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const attachments = (data.attachments ?? []) as RequestAttachment[];
  const updated = data.updatedAt !== data.createdAt;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8} style={styles.back}>
        <Icon name="chevron-left" size="lg" color={palette.ink.primary} />
      </Pressable>

      <View style={styles.typeRow}>
        <View style={styles.typeIcon}>
          <Icon name={TYPE_ICON[data.type]} size="lg" color={palette.metal.rose} />
        </View>
        <RNBadge label={STATUS_LABEL[data.status]} tone={STATUS_TONE[data.status]} dot />
      </View>

      <Text style={styles.typeLabel}>{TYPE_LABEL[data.type]}</Text>
      <Text style={styles.title}>{data.title}</Text>

      <Text style={styles.sectionLabel}>DESCRIPTION</Text>
      <Text style={styles.description}>{data.description}</Text>

      {attachments.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
          <View style={styles.attachments}>
            {attachments.map((a, i) => {
              const opening = openingPath === a.path;
              return (
                <Pressable
                  key={`${a.path}-${i}`}
                  onPress={() => void openAttachment(a)}
                  disabled={opening}
                >
                  <RNCard padding="sm" style={styles.attachment}>
                    <Icon name="paperclip" size="sm" color={palette.metal.rose} />
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {opening ? (
                      <ActivityIndicator size="small" color={palette.metal.rose} />
                    ) : (
                      <Icon name="external-link" size="sm" color={palette.ink.subtle} />
                    )}
                  </RNCard>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.dates}>
        <Text style={styles.dateLine}>Submitted {formatDateTime(data.createdAt)}</Text>
        {updated && <Text style={styles.dateLine}>Last updated {formatDateTime(data.updatedAt)}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  content: { paddingTop: space[8], paddingHorizontal: space[5], paddingBottom: space[12], gap: space[3] },
  back: { marginBottom: space[2] },
  center: {
    flex: 1,
    backgroundColor: palette.bg.base,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  backLink: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.metal.rose,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: palette.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
    marginTop: space[2],
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  sectionLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
    marginTop: space[4],
  },
  description: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
    lineHeight: typography.size.bodyLG * typography.lineHeight.relaxed,
  },
  attachments: { gap: space[2] },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  attachmentName: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  dates: { marginTop: space[6], gap: space[1] },
  dateLine: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.subtle,
  },
});
