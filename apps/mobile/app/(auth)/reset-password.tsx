import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RNButton, RNInput } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Reset-password — entered via deep link: bdtconnect://reset-password?token=…
 * Expo Router's `useLocalSearchParams` reads the token from the URL.
 * Per-server: this endpoint also revokes every active refresh token for the
 * user, so any other devices get bounced to login.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !!token && password.length >= 12 && password === confirm && !busy;

  const handleSubmit = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await resetPassword({ token: String(token), password });
      Alert.alert('Password updated', 'Sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch {
      // Error message is already on the store; render below.
    } finally {
      setBusy(false);
    }
  };

  const error = useAuthStore((s) => s.error);

  if (!token) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.title}>Reset link missing</Text>
        <Text style={styles.subtitle}>
          Open the link directly from your email. If it's expired, request a new one.
        </Text>
        <View style={{ marginTop: space[6] }}>
          <RNButton
            label="Back to sign in"
            variant="ghost"
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>
          Minimum 12 characters. Mix of upper, lower, and numbers is required by the server.
        </Text>

        <View style={{ gap: space[4], marginTop: space[6] }}>
          <RNInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            hint={tooShort ? 'Too short — at least 12 characters' : undefined}
            invalid={tooShort}
          />
          <RNInput
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            hint={mismatch ? "Doesn't match" : undefined}
            invalid={mismatch}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <RNButton
            label={busy ? 'Updating…' : 'Update password'}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={!canSubmit}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: { padding: space[6], paddingTop: space[16] },
  center: { padding: space[6], paddingTop: space[20], alignItems: 'center' },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: space[3],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    textAlign: 'center',
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  error: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.status.danger,
    textAlign: 'center',
  },
});
