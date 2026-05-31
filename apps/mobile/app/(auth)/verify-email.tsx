import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RNButton } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Verify-email screen serves two flows:
 *
 *   1. POST-REGISTER: no `token` in URL. Shows "check your inbox" w/
 *      a Resend button (60s cooldown). When the app comes back to
 *      foreground we re-fetch /me; if `emailVerifiedAt` is now set,
 *      jump to the app.
 *
 *   2. DEEP-LINK: bdtconnect://verify-email?token=… opens here too.
 *      On mount we call /api/auth/verify-email; on success → /(client)/home.
 */
const RESEND_COOLDOWN_SEC = 60;

export default function VerifyEmailScreen() {
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>(
    token ? 'verifying' : 'idle',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // ----- Branch 2: token in URL → verify immediately -----
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await verifyEmail({ token: String(token) });
        setStatus('verified');
        setTimeout(() => router.replace('/(client)/home'), 1200);
      } catch (err) {
        setStatus('error');
        setErrorMsg((err as Error).message);
      }
    })();
  }, [token, verifyEmail]);

  // ----- Branch 1: foreground listener → recheck /me -----
  useEffect(() => {
    if (token) return; // not the post-register branch
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'active') {
        const me = await refreshMe();
        if (me?.emailVerifiedAt) router.replace('/(client)/home');
      }
    });
    return () => sub.remove();
  }, [token, refreshMe]);

  // ----- Cooldown timer for Resend -----
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SEC);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    try {
      await resendVerification();
      startCooldown();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // ----- Render -----
  if (status === 'verifying') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.title}>Verifying…</Text>
        <Text style={styles.subtitle}>One moment.</Text>
      </View>
    );
  }
  if (status === 'verified') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.title}>Email verified</Text>
        <Text style={styles.subtitle}>You're in. Loading your dashboard…</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.title}>Verification failed</Text>
        <Text style={styles.subtitle}>
          {errorMsg ?? 'This link has expired or already been used. Request a new one.'}
        </Text>
        <View style={{ marginTop: space[6] }}>
          <RNButton label="Sign in" variant="primary" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </View>
    );
  }

  // Default — post-register pending state.
  return (
    <View style={[styles.root, styles.center]}>
      <Text style={styles.title}>Check your inbox</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to {email ?? 'your email'}. Tap it to confirm your address —
        you'll come right back here.
      </Text>

      <View style={{ marginTop: space[8], gap: space[3], width: '100%' }}>
        <RNButton
          label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          variant="ghost"
          onPress={handleResend}
          disabled={cooldown > 0}
          fullWidth
        />
        <RNButton
          label="Already verified? Sign in"
          variant="text"
          onPress={() => router.replace('/(auth)/login')}
        />
      </View>

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  center: { padding: space[6], paddingTop: space[20], alignItems: 'center', flex: 1 },
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
    marginTop: space[5],
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.status.danger,
    textAlign: 'center',
  },
});
