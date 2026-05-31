import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RNButton, RNCard } from '@/components/ui';
import { palette, radius, space, typography } from '@/styles/appTokens';
import type { Tier } from '@/stores/stripe';

interface PlanCopy {
  tier: Tier;
  name: string;
  price: number;
  features: string[];
  notIncluded: string[];
  popular?: boolean;
}

// Two headline services across both tiers: Website Maintenance + Social Media
// Management. We sell the relationship, not a feature checklist — keep it short.
const PLANS: PlanCopy[] = [
  {
    tier: 'basic',
    name: 'Basic',
    price: 100,
    features: ['Website Maintenance', 'Social Media Management', 'Up to 5 service requests / month'],
    notIncluded: ['Priority turnaround'],
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: 175,
    popular: true,
    features: [
      'Website Maintenance',
      'Social Media Management',
      'Up to 20 service requests / month',
      'Priority turnaround',
    ],
    notIncluded: [],
  },
];

/**
 * Onboarding step 1 of 2. The user picks a tier; we hand off to
 * payment-setup which collects the card via Stripe's PaymentSheet, then
 * `POST /api/stripe/subscription/create { tier, setupIntentId }`.
 */
export function PlanSelectionScreen() {
  const [selected, setSelected] = useState<Tier>('premium');

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Website Maintenance + Social Media Management, handled by BDT.
        </Text>
        <Text style={styles.subtitle}>14-day free trial — cancel anytime</Text>
      </View>

      <View style={{ gap: space[3] }}>
        {PLANS.map((p) => (
          <PlanCard
            key={p.tier}
            plan={p}
            selected={selected === p.tier}
            onSelect={() => setSelected(p.tier)}
          />
        ))}
      </View>

      <View style={{ marginTop: space[6] }}>
        <RNButton
          label="Continue"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() =>
            router.push({
              pathname: '/(onboarding)/payment-setup',
              params: { tier: selected },
            } as never)
          }
        />
      </View>

      <Text style={styles.fineprint}>
        Your card will be charged after your 14-day trial ends. Cancel anytime before then.
      </Text>
    </ScrollView>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanCopy;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable onPress={onSelect} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
      <RNCard framed={selected}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          {plan.popular && <Text style={styles.popular}>MOST POPULAR</Text>}
          <Text style={styles.planName}>{plan.name}</Text>
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>${plan.price}</Text>
        <Text style={styles.perMo}>/mo</Text>
      </View>

      <View style={styles.features}>
        {plan.features.map((f) => (
          <Text key={f} style={styles.featureIn}>✓  {f}</Text>
        ))}
        {plan.notIncluded.map((f) => (
          <Text key={f} style={styles.featureOut}>✗  {f}</Text>
        ))}
      </View>
      </RNCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[5],
    paddingTop: space[10],
    paddingBottom: space[10],
    gap: space[5],
  },
  header: { gap: space[2] },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayXL,
    color: palette.ink.primary,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.muted,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  popular: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
    marginBottom: space[1],
  },
  planName: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: palette.metal.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: palette.metal.rose },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: palette.metal.rose,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space[3], gap: space[1] },
  price: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayXL,
    color: palette.metal.rose,
  },
  perMo: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyLG,
    color: palette.ink.muted,
  },
  features: {
    marginTop: space[4],
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
  featureOut: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.subtle,
    textDecorationLine: 'line-through',
  },
  fineprint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.caption,
    color: palette.ink.subtle,
    textAlign: 'center',
    lineHeight: typography.size.caption * typography.lineHeight.relaxed,
  },
});
