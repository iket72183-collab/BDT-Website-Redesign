import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { RNButton, RNInput } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { palette, radius, space, typography } from '@/styles/appTokens';

/**
 * Three-step new-business signup. Each step is a controlled <View>; the wizard
 * state lives in this screen, not in a nested router, so back-navigation is
 * just `setStep(step - 1)` and not a router push.
 *
 * Step 1: account credentials  →  validates email + password strength
 * Step 2: tenant identity      →  business name + URL slug
 * Step 3: review + accept ToS  →  calls register, replaces to verify-email
 */

export default function SignupScreen() {
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agreed, setAgreed] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');

  const passwordValid = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  const slugValid = /^[a-z0-9-]{3,40}$/.test(slug);

  const canStep1 = firstName && lastName && /.+@.+\..+/.test(email) && passwordValid;
  const canStep2 = businessName.length >= 2 && slugValid;
  const canStep3 = agreed && !isLoading;

  const handleSubmit = async () => {
    try {
      await register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        tenant: { slug: slug.trim().toLowerCase(), businessName: businessName.trim() },
      });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
    } catch {
      // Surfaced via authStore.error below.
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ProgressDots step={step} />

        {step === 1 && (
          <View style={{ gap: space[4] }}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Step 1 of 3 · You</Text>
            <RNInput label="First name" value={firstName} onChangeText={setFirstName} />
            <RNInput label="Last name"  value={lastName}  onChangeText={setLastName} />
            <RNInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <RNInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              hint={
                password
                  ? passwordValid
                    ? 'Strong'
                    : '12+ chars, upper + lower + number'
                  : undefined
              }
              invalid={!!password && !passwordValid}
            />
            <RNButton
              label="Continue"
              variant="primary"
              size="lg"
              disabled={!canStep1}
              onPress={() => setStep(2)}
              fullWidth
            />
            <View style={{ alignItems: 'center' }}>
              <Link href="/(auth)/login" asChild>
                <RNButton label="Already have an account?" variant="text" />
              </Link>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: space[4] }}>
            <Text style={styles.title}>Your business</Text>
            <Text style={styles.subtitle}>Step 2 of 3 · The basics</Text>
            <RNInput label="Business name" value={businessName} onChangeText={setBusinessName} />
            <RNInput
              label="URL slug"
              value={slug}
              onChangeText={(v) => setSlug(v.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              hint={
                slug
                  ? slugValid
                    ? `bdtconnect.com/${slug}`
                    : 'lowercase letters, digits, hyphens — 3-40 chars'
                  : 'lowercase letters, digits, hyphens — 3-40 chars'
              }
              invalid={!!slug && !slugValid}
            />
            <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
              <RNButton label="Back" variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }} fullWidth />
              <RNButton
                label="Continue"
                variant="primary"
                disabled={!canStep2}
                onPress={() => setStep(3)}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: space[4] }}>
            <Text style={styles.title}>Review</Text>
            <Text style={styles.subtitle}>Step 3 of 3 · Confirm + go</Text>
            <View style={styles.summary}>
              <SummaryRow label="Name"     value={`${firstName} ${lastName}`} />
              <SummaryRow label="Email"    value={email} />
              <SummaryRow label="Business" value={businessName} />
              <SummaryRow label="URL"      value={`bdtconnect.com/${slug}`} last />
            </View>
            <Pressable onPress={() => setAgreed((v) => !v)} style={styles.tosRow}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <View style={styles.checkboxInner} />}
              </View>
              <Text style={styles.tosText}>
                I agree to the BDT Connect <Text style={styles.tosLink}>Terms</Text> and{' '}
                <Text style={styles.tosLink}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
              <RNButton label="Back" variant="ghost" onPress={() => setStep(2)} style={{ flex: 1 }} fullWidth />
              <RNButton
                label={isLoading ? 'Creating…' : 'Create account'}
                variant="primary"
                disabled={!canStep3}
                onPress={handleSubmit}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={[styles.dot, s <= step && styles.dotOn]} />
      ))}
    </View>
  );
}
function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.summaryLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: { padding: space[6], paddingTop: space[12], gap: space[8] },
  dots: { flexDirection: 'row', gap: space[2], justifyContent: 'center' },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: 'rgba(168,152,128,0.22)' },
  dotOn: { backgroundColor: palette.metal.rose },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  subtitle: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
    textTransform: 'uppercase',
  },
  summary: {
    borderRadius: radius.lg,
    backgroundColor: palette.bg.surface,
    borderWidth: 1,
    borderColor: 'rgba(139,115,85,0.2)',
    paddingHorizontal: space[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,115,85,0.12)',
    gap: space[4],
  },
  summaryLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: 10,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
  },
  summaryValue: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
    textAlign: 'right',
  },

  tosRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[2] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(139,115,85,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { borderColor: palette.metal.rose, backgroundColor: 'rgba(201,168,130,0.12)' },
  checkboxInner: { width: 10, height: 10, borderRadius: 2, backgroundColor: palette.metal.rose },
  tosText: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
    lineHeight: typography.size.bodySM * typography.lineHeight.relaxed,
  },
  tosLink: { color: palette.metal.rose },

  error: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.status.danger,
    textAlign: 'center',
  },
});
