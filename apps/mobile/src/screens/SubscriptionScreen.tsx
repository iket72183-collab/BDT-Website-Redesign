import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RNBadge, RNButton, RNCard, RNSectionHeader } from '@/components/ui';
import { useStripeStore, type Tier } from '@/stores/stripe';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Plan tab. Shows current tier, trial banner, full Basic/Premium comparison,
 * Stripe-hosted billing portal hand-off, and a cancel link.
 *
 * PLANS lives on the API at `apps/api/src/lib/plans.ts` — we mirror the
 * shape here. Until the shared-types package re-exports it, this is the
 * single source of truth for the mobile-side feature lists.
 */

interface PlanCopy {
  tier: Tier;
  name: string;
  price: string;
  features: string[];
  notIncluded: string[];
  popular?: boolean;
}

const PLAN_COPY: PlanCopy[] = [
  {
    tier: 'basic',
    name: 'Basic',
    price: '$100',
    features: [
      'Website redesign',
      'Website maintenance',
      'Direct messaging to BDT team',
    ],
    notIncluded: [
      'Social media management',
      'Monthly performance report',
      'Priority message response',
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: '$175',
    popular: true,
    features: [
      'Website redesign',
      'Website maintenance',
      'Full social media management',
      'Monthly performance report',
      'Priority message response',
      'Direct messaging to BDT team',
    ],
    notIncluded: [],
  },
];

export function SubscriptionScreen() {
  const { subscription, fetchSubscription, upgradeTo, cancelSubscription, openBillingPortal } =
    useStripeStore();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const handleChange = async (target: Tier) => {
    if (target === subscription.tier) return;
    setBusy(target);
    try {
      await upgradeTo(target);
    } catch (err) {
      Alert.alert('Could not update plan', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

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

  const isTrialing = subscription.status === 'trialing';
  const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
  const pendingTierDate = subscription.pendingTierEffectiveAt
    ? new Date(subscription.pendingTierEffectiveAt)
    : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Your Plan</Text>

        {isTrialing && trialEnd && (
          <RNCard style={styles.trialCard}>
            <Text style={styles.trialEyebrow}>FREE TRIAL</Text>
            <Text style={styles.trialTitle}>
              Trial ends {trialEnd.toLocaleDateString()}
            </Text>
            <Text style={styles.alertBody}>
              You won't be charged until then. Cancel anytime before the trial ends.
            </Text>
          </RNCard>
        )}

        {subscription.pendingTier && pendingTierDate && (
          <RNCard style={styles.trialCard}>
            <Text style={styles.trialEyebrow}>PLAN CHANGE SCHEDULED</Text>
            <Text style={styles.trialTitle}>
              Switching to {subscription.pendingTier === 'basic' ? 'Basic' : 'Premium'} on{' '}
              {pendingTierDate.toLocaleDateString()}
            </Text>
          </RNCard>
        )}

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

        <RNSectionHeader title="Choose a plan" />
        <View style={{ gap: space[3] }}>
          {PLAN_COPY.map((p) => {
            const current = subscription.tier === p.tier;
            return (
              <RNCard key={p.tier} framed={current || p.popular}>
                <View style={styles.tierHeader}>
                  <View>
                    {p.popular && <Text style={styles.popular}>MOST POPULAR</Text>}
                    <Text style={styles.tierName}>{p.name}</Text>
                  </View>
                  <Text style={styles.tierPrice}>
                    {p.price}
                    <Text style={styles.tierPerMo}>/mo</Text>
                  </Text>
                </View>

                <View style={styles.features}>
                  {p.features.map((f) => (
                    <Text key={f} style={styles.featureIn}>✓  {f}</Text>
                  ))}
                  {p.notIncluded.map((f) => (
                    <Text key={f} style={styles.featureOut}>✗  {f}</Text>
                  ))}
                </View>

                <View style={{ marginTop: space[4] }}>
                  {current ? (
                    <RNButton label="Current plan" variant="ghost" disabled fullWidth />
                  ) : (
                    <RNButton
                      label={busy === p.tier ? 'Updating…' : `Switch to ${p.name}`}
                      variant="primary"
                      onPress={() => void handleChange(p.tier)}
                      disabled={busy !== null}
                      fullWidth
                    />
                  )}
                </View>
              </RNCard>
            );
          })}
        </View>

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
  trialCard: { borderColor: palette.metal.border },
  trialEyebrow: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  trialTitle: {
    marginTop: space[2],
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  popular: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
    marginBottom: space[1],
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
    marginTop: space[2],
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
    gap: space[1],
  },
  featureIn: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.primary,
  },
  featureOut: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.subtle,
    textDecorationLine: 'line-through',
  },
});
