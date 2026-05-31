import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialAccessMethod, SocialAccount, SocialPlatform } from '@bdt/shared-types';
import { RNBadge, RNButton, RNCard, RNInput, Icon } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import {
  DELEGATED_INSTRUCTIONS,
  METHOD_PICKER,
  PLATFORM_ICON,
  PLATFORM_LABEL,
  UI_PLATFORMS,
} from './socialMeta';

const METHOD_ORDER: SocialAccessMethod[] = ['delegated', 'create_for_me', 'credentials'];

export function AddAccountScreen() {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [method, setMethod] = useState<SocialAccessMethod | null>(null);
  const [handle, setHandle] = useState('');
  const [notes, setNotes] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Only offer platforms the client hasn't connected yet.
  const existing = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api<{ data: SocialAccount[] }>('/api/social-accounts'),
    select: (r) => r.data,
  });
  const taken = new Set((existing.data ?? []).map((a) => a.platform));
  const available = UI_PLATFORMS.filter((p) => !taken.has(p));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api<{ data: SocialAccount }>('/api/social-accounts', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          accessMethod: method,
          handle: handle.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const created = res.data;
      if (method === 'credentials') {
        await api(`/api/social-accounts/${created.id}/credentials`, {
          method: 'PATCH',
          body: JSON.stringify({ username: username.trim(), password }),
        });
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-accounts'] });
      router.back();
      Alert.alert('Account connected', "BDT will take it from here. You can manage it anytime.");
    },
    onError: (err) =>
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.'),
  });

  const back = () => {
    if (method) setMethod(null);
    else if (platform) setPlatform(null);
    else router.back();
  };

  // Step 1 — platform picker.
  if (!platform) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Header onBack={back} title="Connect Account" />
        <Text style={styles.prompt}>Which platform?</Text>
        {available.length === 0 ? (
          <Text style={styles.muted}>You've connected every available platform.</Text>
        ) : (
          <View style={styles.grid}>
            {available.map((p) => (
              <Pressable key={p} style={styles.gridItem} onPress={() => setPlatform(p)}>
                <RNCard padding="md" style={styles.platformCard}>
                  <Icon name={PLATFORM_ICON[p]} size="lg" color={palette.metal.rose} />
                  <Text style={styles.platformLabel}>{PLATFORM_LABEL[p]}</Text>
                </RNCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // Step 2 — access method picker.
  if (!method) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Header onBack={back} title={PLATFORM_LABEL[platform]} />
        <Text style={styles.prompt}>How should BDT access it?</Text>
        {METHOD_ORDER.map((m) => {
          const copy = METHOD_PICKER[m];
          return (
            <Pressable key={m} onPress={() => setMethod(m)}>
              <RNCard padding="md" style={styles.methodCard}>
                <View style={styles.methodHead}>
                  <Text style={styles.methodTitle}>{copy.title}</Text>
                  {copy.recommended && <RNBadge label="Recommended" tone="confirmed" />}
                </View>
                <Text style={styles.methodBlurb}>{copy.blurb}</Text>
              </RNCard>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  // Step 3 — details.
  const isCredentials = method === 'credentials';
  const canSubmit =
    !isCredentials || (username.trim().length > 0 && password.length > 0);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Header onBack={back} title={METHOD_PICKER[method].title} />

      <RNInput
        label="Handle (optional)"
        placeholder="@username"
        autoCapitalize="none"
        value={handle}
        onChangeText={setHandle}
        containerStyle={styles.field}
      />

      {method === 'delegated' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How to grant access</Text>
          <Text style={styles.infoBody}>{DELEGATED_INSTRUCTIONS[platform]}</Text>
          <Text style={styles.infoBody}>
            Once you've added us, set the status to "Access Granted" from the account page.
          </Text>
        </View>
      )}

      {method === 'create_for_me' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>
            BDT will create this account for your business and share the details once it's ready.
          </Text>
        </View>
      )}

      {isCredentials && (
        <>
          <RNInput
            label="Username or email"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            containerStyle={styles.field}
          />
          <RNInput
            label="Password"
            autoCapitalize="none"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.field}
            rightIcon={
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size="sm" color={palette.ink.muted} />
              </Pressable>
            }
          />
          <View style={styles.noticeCard}>
            <Icon name="lock" size="sm" color={palette.metal.rose} />
            <Text style={styles.noticeText}>
              Your login is encrypted and only accessible to BDT staff.
            </Text>
          </View>
          <View style={styles.noticeCard}>
            <Icon name="info" size="sm" color={palette.ink.muted} />
            <Text style={styles.noticeText}>
              If 2FA is enabled on this account, BDT may need to contact you for a verification code.
            </Text>
          </View>
        </>
      )}

      <RNInput
        label="Notes (optional)"
        placeholder="Any instructions for BDT"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        containerStyle={styles.field}
      />

      <RNButton
        label={mutation.isPending ? 'Connecting…' : 'Connect Account'}
        variant="primary"
        disabled={!canSubmit || mutation.isPending}
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={styles.submit}
      />
    </ScrollView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
        <Icon name="chevron-left" size="lg" color={palette.ink.primary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  content: { paddingTop: space[8], paddingHorizontal: space[5], paddingBottom: space[12], gap: space[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  prompt: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    marginBottom: space[2],
  },
  muted: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  gridItem: { width: '47%' },
  platformCard: { alignItems: 'center', gap: space[2], paddingVertical: space[5] },
  platformLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  methodCard: { gap: space[2] },
  methodHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  methodTitle: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
  methodBlurb: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
    lineHeight: typography.size.bodySM * typography.lineHeight.relaxed,
  },
  field: { marginTop: space[1] },
  infoCard: {
    gap: space[2],
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: palette.bg.raised,
  },
  infoTitle: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
  infoBody: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
    lineHeight: typography.size.bodySM * typography.lineHeight.relaxed,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  noticeText: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
  submit: { marginTop: space[4] },
});
