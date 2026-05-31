import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialAccount } from '@bdt/shared-types';
import { RNBadge, RNButton, RNInput, Icon } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import {
  DELEGATED_INSTRUCTIONS,
  PLATFORM_ICON,
  PLATFORM_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from './socialMeta';

export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api<{ data: SocialAccount[] }>('/api/social-accounts'),
    select: (r) => r.data,
  });
  const account = data?.find((a) => a.id === id);

  const [notes, setNotes] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (account) setNotes(account.notes ?? '');
  }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNotes = useMutation({
    mutationFn: (value: string) =>
      api(`/api/social-accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ notes: value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-accounts'] }),
  });

  const saveCredentials = useMutation({
    mutationFn: () =>
      api(`/api/social-accounts/${id}/credentials`, {
        method: 'PATCH',
        body: JSON.stringify({ username: username.trim(), password }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-accounts'] });
      setReplacing(false);
      setUsername('');
      setPassword('');
      Alert.alert('Login updated', 'Your new login is encrypted and saved.');
    },
    onError: (err) =>
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.'),
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/social-accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-accounts'] });
      router.back();
    },
  });

  const confirmRemove = () =>
    Alert.alert('Remove account?', 'BDT will lose access and any stored login is deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
    ]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.metal.rose} />
      </View>
    );
  }
  if (!account) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>This account could not be found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8} style={styles.back}>
        <Icon name="chevron-left" size="lg" color={palette.ink.primary} />
      </Pressable>

      <View style={styles.titleRow}>
        <View style={styles.platformIcon}>
          <Icon name={PLATFORM_ICON[account.platform]} size="lg" color={palette.metal.rose} />
        </View>
        <RNBadge label={STATUS_LABEL[account.status]} tone={STATUS_TONE[account.status]} dot />
      </View>
      <Text style={styles.platform}>{PLATFORM_LABEL[account.platform]}</Text>
      <Text style={styles.handle}>{account.handle ?? 'No handle added'}</Text>

      {/* Access method section */}
      <Text style={styles.sectionLabel}>ACCESS</Text>
      {account.accessMethod === 'credentials' && (
        <View style={styles.infoCard}>
          {account.hasCredentials ? (
            <Text style={styles.infoBody}>
              Login saved · Last updated {formatDate(account.secretUpdatedAt)}
            </Text>
          ) : (
            <Text style={styles.infoBody}>No login saved yet.</Text>
          )}
          {!replacing ? (
            <RNButton
              label={account.hasCredentials ? 'Replace Login' : 'Add Login'}
              variant="ghost"
              onPress={() => setReplacing(true)}
            />
          ) : (
            <View style={{ gap: space[3] }}>
              <RNInput label="Username or email" autoCapitalize="none" value={username} onChangeText={setUsername} />
              <RNInput
                label="Password"
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                rightIcon={
                  <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size="sm" color={palette.ink.muted} />
                  </Pressable>
                }
              />
              <View style={styles.replaceActions}>
                <RNButton label="Cancel" variant="text" onPress={() => setReplacing(false)} />
                <RNButton
                  label={saveCredentials.isPending ? 'Saving…' : 'Save Login'}
                  variant="primary"
                  loading={saveCredentials.isPending}
                  disabled={!username.trim() || !password || saveCredentials.isPending}
                  onPress={() => saveCredentials.mutate()}
                />
              </View>
            </View>
          )}
        </View>
      )}
      {account.accessMethod === 'delegated' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>{DELEGATED_INSTRUCTIONS[account.platform]}</Text>
        </View>
      )}
      {account.accessMethod === 'create_for_me' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>BDT will create this account for your business.</Text>
        </View>
      )}

      {/* Notes — editable, saved on blur */}
      <Text style={styles.sectionLabel}>NOTES</Text>
      <RNInput
        label="Instructions for BDT"
        value={notes}
        onChangeText={setNotes}
        onBlur={() => {
          if (notes !== (account.notes ?? '')) saveNotes.mutate(notes.trim());
        }}
        multiline
        numberOfLines={4}
      />

      <RNButton
        label="Remove Account"
        variant="danger"
        onPress={confirmRemove}
        loading={remove.isPending}
        style={styles.remove}
      />
    </ScrollView>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
  muted: { fontFamily: typography.family.body, fontSize: typography.size.bodyMD, color: palette.ink.muted },
  link: { fontFamily: typography.family.bodySemibold, fontSize: typography.size.bodyMD, color: palette.metal.rose },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  platformIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: palette.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platform: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
    marginTop: space[2],
  },
  handle: { fontFamily: typography.family.body, fontSize: typography.size.bodyMD, color: palette.ink.muted },
  sectionLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
    marginTop: space[4],
  },
  infoCard: { gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: palette.bg.raised },
  infoBody: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
    lineHeight: typography.size.bodySM * typography.lineHeight.relaxed,
  },
  replaceActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space[3] },
  remove: { marginTop: space[6] },
});
