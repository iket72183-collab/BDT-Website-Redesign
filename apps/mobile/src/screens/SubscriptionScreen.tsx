import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RNBadge, RNButton, RNCard, RNSectionHeader } from '@/components/ui';
import { useStripeStore, PREMIUM_PLAN } from '@/stores/stripe';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Plan tab. Single-plan model: shows the one Premium plan ($100/mo) + features,
 * the Stripe-hosted billing portal hand-off, and a cancel link. No trial, no
 * tier comparison, no upgrade — there's only one plan.
 */
export function SubscriptionScreen() {
  const { subscription, fetchSubscription, cancelSubscription, openBillingPortal } =
    useStripeStore();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel subscription?',
      'You keep access until the end of the current billing period.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel at period end',
          style: 'destructive',
          onPress: async () => {
            setBusy('cancel');
            try {
              const cancelAt = await cancelSubscription();
              Alert.alert(
                'Cancellation scheduled',
                cancelAt
                  ? `Your access ends ${new Date(cancelAt).toLocaleDateString()}.`
                  : 'Cancellation scheduled.',
              );
            } catch (err) {
              Alert.alert('Cancellation failed', (err as Error).message);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Your Plan</Text>

        {subscription.status === 'past_due' && (
          <RNCard style={styles.alert}>
            <RNBadge tone="cancelled" label="Payment failed" dot />
            <Text style={styles.alertTitle}>Update your payment method</Text>
            <Text style={styles.alertBody}>
              Your last subscription charge failed. Update billing to keep your account active.
            </Text>
            <View style={{ marginTop: space[3] }}>
              <RNButton label="Manage Billing" variant="primary" onPress={openBillingPortal} fullWidth />
            </View>
          </RNCard>
        )}

        <RNCard framed>
          <View style={styles.tierHeader}>
            <Text style={styles.tierName}>{PREMIUM_PLAN.name}</Text>
            <Text style={styles.tierPrice}>
              ${PREMIUM_PLAN.price}
              <Text style={styles.tierPerMo}>/mo</Text>
            </Text>
          </View>

          <View style={styles.features}>
            {PREMIUM_PLAN.features.map((f) => (
              <Text key={f} style={styles.featureIn}>✓  {f}</Text>
            ))}
          </View>
        </RNCard>

        <RNSectionHeader title="Billing" />
        <RNCard padding="sm">
          <RNButton label="Manage Billing on Stripe" variant="ghost" onPress={openBillingPortal} />
        </RNCard>

        {subscription.tier && !subscription.cancelAt && (
          <View style={{ marginTop: space[6], alignItems: 'center' }}>
            <RNButton
              label="Cancel subscription"
              variant="text"
              onPress={handleCancel}
              disabled={busy === 'cancel'}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  scroll: { paddingHorizontal: space[5], paddingTop: space[8], paddingBottom: space[10], gap: space[4] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.ink.primary,
  },
  alert: { borderColor: 'rgba(139, 32, 32, 0.5)' },
  alertTitle: {
    marginTop: space[2],
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  alertBody: {
    marginTop: space[1],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    lineHeight: typography.size.bodyMD * typography.lineHeight.relaxed,
  },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  tierName: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  tierPrice: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.metal.rose,
  },
  tierPerMo: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
  },
  features: {
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,115,85,0.18)',
    gap: space[2],
  },
  featureIn: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.primary,
  },
});
