import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { RNButton, RNCard } from '@/components/ui';
import { useStripeStore, PREMIUM_PLAN } from '@/stores/stripe';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Onboarding step 2 of 2 — card capture.
 *
 * Single-plan model, no free trial: the SetupIntent + PaymentSheet tokenizes a
 * card, then `POST /api/stripe/subscription/create { setupIntentId }` creates
 * the Premium subscription and bills it immediately. Work starts right away.
 */
export function PaymentSetupScreen() {
  const stripePublishableKey =
    (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ?? '';
  const cardCaptureAvailable = stripePublishableKey.length > 0;

  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();
  const { createSubscription, createSetupIntent } = useStripeStore();

  const [sheetReady, setSheetReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);

  // Prepare the PaymentSheet on mount — only when card capture is wired.
  useEffect(() => {
    if (!cardCaptureAvailable) return;
    let cancelled = false;
    (async () => {
      try {
        const { clientSecret } = await createSetupIntent();
        if (cancelled) return;
        setSetupIntentSecret(clientSecret);
        const { error } = await initPaymentSheet({
          setupIntentClientSecret: clientSecret,
          merchantDisplayName: 'BDT Connect',
        });
        if (error) {
          Alert.alert('Setup failed', error.message);
        } else {
          setSheetReady(true);
        }
      } catch (err) {
        Alert.alert('Setup failed', (err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [cardCaptureAvailable, createSetupIntent, initPaymentSheet]);

  const handlePay = async () => {
    if (!sheetReady) return;
    setSubmitting(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert('Payment setup failed', error.message);
        return;
      }
      if (!setupIntentSecret) {
        Alert.alert('Card required', 'Payment setup expired. Please try adding your card again.');
        return;
      }
      const retrieved = await retrieveSetupIntent(setupIntentSecret);
      if (retrieved.error || !retrieved.setupIntent) {
        Alert.alert('Payment setup failed', retrieved.error?.message ?? 'Please try again.');
        return;
      }
      await createSubscription({ setupIntentId: retrieved.setupIntent.id });
      router.replace('/(client)/home' as never);
    } catch (err) {
      Alert.alert('Something went wrong', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Set Up Payment</Text>
      <Text style={styles.subtitle}>
        Billed today, then ${PREMIUM_PLAN.price}/month. Cancel anytime.
      </Text>

      <RNCard>
        <Text style={styles.eyebrow}>YOUR PLAN</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.planName}>{PREMIUM_PLAN.name}</Text>
          <Text style={styles.price}>
            ${PREMIUM_PLAN.price}
            <Text style={styles.perMo}>/mo</Text>
          </Text>
        </View>
      </RNCard>

      {cardCaptureAvailable ? (
        <RNButton
          label={submitting ? 'Working…' : `Get Started — $${PREMIUM_PLAN.price}/mo`}
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!sheetReady || submitting}
          onPress={handlePay}
        />
      ) : (
        <Text style={styles.subtitle}>
          Payment isn’t available yet. Please reach out to BDT to get set up.
        </Text>
      )}

      <RNButton
        label="← Back"
        variant="text"
        onPress={() => router.back()}
        disabled={submitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[10],
    paddingBottom: space[10],
    gap: space[4],
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayXL,
    color: palette.ink.primary,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  eyebrow: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  summaryRow: {
    marginTop: space[3],
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  planName: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  price: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.metal.rose,
  },
  perMo: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
});
