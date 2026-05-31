import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { RNButton, RNCard } from '@/components/ui';
import { useStripeStore, type Tier } from '@/stores/stripe';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Onboarding step 2 of 2.
 *
 * Two modes, selected at runtime from the Stripe publishable key:
 *
 * 1. **Card-up-front** (key present): SetupIntent + PaymentSheet tokenizes a
 *    card, then `POST /api/stripe/subscription/create { tier, setupIntentId }`
 *    starts the 14-day trial. The card is billed on day 15.
 *
 * 2. **No-card trial** (key empty — Stripe not wired yet): single tap of
 *    "Start My Free Trial" calls `POST /api/stripe/subscription/start-trial`.
 *    The backend either creates an incomplete Stripe subscription
 *    (when its own STRIPE_SECRET_KEY is configured) or a DB-only trial
 *    (when it isn't). User is prompted to add a card before day 15.
 *
 * The card-up-front screen also offers a secondary "Start without card"
 * action so a client can defer payment even when billing is fully wired.
 */
export function PaymentSetupScreen() {
  const { tier } = useLocalSearchParams<{ tier: Tier }>();
  const selectedTier: Tier = tier === 'premium' ? 'premium' : 'basic';
  const planName = selectedTier === 'premium' ? 'Premium' : 'Basic';
  const planPrice = selectedTier === 'premium' ? 175 : 100;

  const stripePublishableKey =
    (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ?? '';
  const cardCaptureAvailable = stripePublishableKey.length > 0;

  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();
  const { createSubscription, createSetupIntent, startTrialWithoutCard } = useStripeStore();

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
        Alert.alert(
          'Card required',
          'Payment setup expired. Please try adding your card again.',
        );
        return;
      }
      const retrieved = await retrieveSetupIntent(setupIntentSecret);
      if (retrieved.error || !retrieved.setupIntent) {
        Alert.alert('Payment setup failed', retrieved.error?.message ?? 'Please try again.');
        return;
      }
      await createSubscription({ tier: selectedTier, setupIntentId: retrieved.setupIntent.id });
      router.replace('/(client)/home' as never);
    } catch (err) {
      Alert.alert('Something went wrong', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoCardTrial = async () => {
    setSubmitting(true);
    try {
      await startTrialWithoutCard(selectedTier);
      router.replace('/(client)/home' as never);
    } catch (err) {
      Alert.alert('Could not start trial', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{cardCaptureAvailable ? 'Set Up Payment' : 'Start Your Trial'}</Text>
      <Text style={styles.subtitle}>
        {cardCaptureAvailable
          ? "14-day free trial. We'll charge your card on day 15 — cancel anytime before then."
          : "14-day free trial. No card needed to start — we'll prompt you to add one before day 15."}
      </Text>

      <RNCard>
        <Text style={styles.eyebrow}>SELECTED PLAN</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.price}>
            ${planPrice}
            <Text style={styles.perMo}>/mo</Text>
          </Text>
        </View>
      </RNCard>

      {cardCaptureAvailable ? (
        <>
          <RNButton
            label={submitting ? 'Working…' : 'Start My Free Trial'}
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!sheetReady || submitting}
            onPress={handlePay}
          />
          <RNButton
            label="Skip — add card later"
            variant="ghost"
            fullWidth
            disabled={submitting}
            onPress={handleNoCardTrial}
          />
        </>
      ) : (
        <RNButton
          label={submitting ? 'Working…' : 'Start My Free Trial'}
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={submitting}
          onPress={handleNoCardTrial}
        />
      )}

      <RNButton
        label="← Back to plans"
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
