import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { RNButton, RNInput } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { palette, space, typography } from '@/styles/appTokens';
import { ApiError } from '@/api/client';

/**
 * Login screen — wired to authStore.login. Tenant slug comes from the
 * tenantStore (set during the preceding tenant-select step). Platform admins
 * can leave it unset; the API resolves them by role.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailUnverified, setEmailUnverified] = useState(false);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const tenantSlug = useTenantStore((s) => s.slug);

  const handleSubmit = async () => {
    setEmailUnverified(false);
    try {
      const user = await login({ email: email.trim(), password, tenantSlug: tenantSlug ?? undefined });
      // Anyone reaching this screen and signing in successfully is a client.
      // Platform admins use a separate web surface. The (client) layout
      // decides whether to redirect into onboarding.
      if (user.role === 'client') {
        router.replace('/(client)/home' as never);
      } else {
        router.replace('/(auth)/tenant-select' as never);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'email_unverified' || err.code === 'EMAIL_UNVERIFIED')) {
        setEmailUnverified(true);
      }
    }
  };

  const handleResend = () => {
    Alert.alert(
      'Need a new verification link?',
      "Sign in once with your password, then tap Resend on the verification screen.",
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            {tenantSlug ? `Signing in to ${tenantSlug}` : 'Sign in to your account'}
          </Text>
        </View>

        <View style={{ gap: space[4] }}>
          <RNInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <RNInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {emailUnverified && (
            <RNButton label="Resend verification email" variant="ghost" size="sm" onPress={handleResend} />
          )}

          <RNButton
            label={isLoading ? 'Signing in…' : 'Sign in'}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={isLoading || !email || !password}
            fullWidth
          />

          <View style={styles.linksRow}>
            <Link href="/(auth)/forgot-password" asChild>
              <RNButton label="Forgot password?" variant="text" size="sm" />
            </Link>
            <Link href="/(auth)/signup" asChild>
              <RNButton label="New here? Sign up" variant="text" size="sm" />
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: { padding: space[6], paddingTop: space[16], gap: space[8] },
  header: { gap: space[2] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayXL,
    color: palette.ink.primary,
    letterSpacing: typography.tracking.tight,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  error: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.status.danger,
    textAlign: 'center',
  },
  linksRow: {
    marginTop: space[2],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
