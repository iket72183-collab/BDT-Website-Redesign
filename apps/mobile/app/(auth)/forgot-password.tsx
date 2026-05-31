import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { RNButton, RNInput } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Forgot password — anti-enumeration. ALWAYS shows the success state
 * after submit, even if the email doesn't exist on file. The API does the
 * same (returns 200 either way); the UI mirrors that.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const tenantSlug = useTenantStore((s) => s.slug);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await forgotPassword({ email: email.trim(), tenantSlug: tenantSlug ?? undefined });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{sent ? 'Check your inbox' : 'Reset your password'}</Text>
        <Text style={styles.subtitle}>
          {sent
            ? `If an account exists for ${email}, we sent a reset link. The link expires in 1 hour.`
            : "Enter your email and we'll send you a link to set a new password."}
        </Text>

        {!sent && (
          <View style={{ gap: space[4], marginTop: space[6] }}>
            <RNInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <RNButton
              label={busy ? 'Sending…' : 'Send reset link'}
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              disabled={busy || !email}
              fullWidth
            />
          </View>
        )}

        <View style={{ marginTop: space[8], alignItems: 'center' }}>
          <Link href="/(auth)/login" asChild>
            <RNButton label="Back to sign in" variant="text" />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: { padding: space[6], paddingTop: space[16] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  subtitle: {
    marginTop: space[3],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
});
