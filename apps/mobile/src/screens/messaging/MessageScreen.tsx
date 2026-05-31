import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RNButton, RNCard } from '@/components/ui';
import { api } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';

const MAX_BODY = 2000;

interface TenantTier {
  subscriptionTier: 'basic' | 'premium';
}

/**
 * Compose form. On success we replace the form with a confirmation block
 * that includes the SLA copy (24h premium / 48h basic) — feeds the user
 * expectations about when BDT will respond.
 */
export function MessageScreen() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api<{ data: TenantTier }>('/api/tenant'),
    select: (r) => r.data,
  });
  const isPremium = tenant?.subscriptionTier === 'premium';
  const slaText = isPremium ? 'within 24 hours' : 'within 48 hours';

  const sendMutation = useMutation({
    mutationFn: (input: { subject?: string; body: string }) =>
      api<{ data: { sent: boolean } }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });

  const handleSend = async () => {
    if (body.trim().length === 0) return;
    try {
      await sendMutation.mutateAsync({
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      setSentTo(`We'll reply ${slaText}.`);
    } catch {
      // ApiError surfaces a `message` via the api() wrapper; we leave the
      // form populated so the user can retry without re-typing.
    }
  };

  const reset = () => {
    setSubject('');
    setBody('');
    setSentTo(null);
  };

  if (sentTo) {
    return (
      <View style={styles.successWrap}>
        <Text style={styles.successMark}>✓</Text>
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successBody}>{sentTo}</Text>
        <View style={styles.successButtons}>
          <RNButton label="Send another" variant="ghost" onPress={reset} />
          <RNButton
            label="Back to home"
            variant="primary"
            onPress={() => router.push('/(client)/home' as never)}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg.base }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Message BDT Team</Text>
        <Text style={styles.subtitle}>{`We respond ${slaText}.`}</Text>

        <RNCard padding="md">
          <Text style={styles.label}>SUBJECT (OPTIONAL)</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="What's this about?"
            placeholderTextColor={palette.ink.subtle}
            maxLength={200}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: space[5] }]}>YOUR MESSAGE</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Type your message..."
            placeholderTextColor={palette.ink.subtle}
            multiline
            maxLength={MAX_BODY}
            style={styles.bodyInput}
          />
          <Text style={styles.counter}>
            {body.length} / {MAX_BODY}
          </Text>
        </RNCard>

        {sendMutation.isError && (
          <Text style={styles.errorText}>
            Couldn't send — please try again in a moment.
          </Text>
        )}

        <RNButton
          label={sendMutation.isPending ? 'Sending…' : 'Send Message'}
          variant="primary"
          size="lg"
          fullWidth
          loading={sendMutation.isPending}
          disabled={body.trim().length === 0 || sendMutation.isPending}
          onPress={handleSend}
        />

        <RNButton
          label="Message history"
          variant="text"
          onPress={() => router.push('/(client)/messages/history' as never)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[8],
    paddingBottom: space[10],
    gap: space[4],
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  label: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  input: {
    marginTop: space[2],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
    paddingVertical: space[3],
    borderBottomWidth: 0.5,
    borderBottomColor: palette.metal.deep,
  },
  bodyInput: {
    marginTop: space[2],
    minHeight: 150,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
    textAlignVertical: 'top',
    paddingVertical: space[3],
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: space[2],
    fontFamily: typography.family.body,
    fontSize: typography.size.caption,
    color: palette.ink.subtle,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.status.danger,
  },
  successWrap: {
    flex: 1,
    backgroundColor: palette.bg.base,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[6],
    gap: space[3],
  },
  successMark: {
    fontFamily: typography.family.displayBold,
    fontSize: 72,
    color: palette.metal.rose,
  },
  successTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  successBody: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.muted,
    textAlign: 'center',
    marginBottom: space[6],
  },
  successButtons: { flexDirection: 'row', gap: space[3] },
});
