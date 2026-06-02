import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RNButton, RNCard } from '@/components/ui';
import { PREMIUM_PLAN } from '@/stores/stripe';
import { palette, space, typography } from '@/styles/appTokens';

/**
 * Onboarding step 1 of 2 — "What you get".
 *
 * Single-plan model: there's nothing to choose, so this screen sells the one
 * Premium plan (price + feature list) and hands off to payment-setup. No free
 * trial, no plan comparison.
 */
export function PlanSelectionScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>What You Get</Text>
        <Text style={styles.subtitle}>
          Your full digital presence — social media, website, and creative assets — managed by BDT.
        </Text>
      </View>

      <RNCard framed>
        <Text style={styles.eyebrow}>{PREMIUM_PLAN.name.toUpperCase()}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>${PREMIUM_PLAN.price}</Text>
          <Text style={styles.perMo}>/month</Text>
        </View>

        <View style={styles.features}>
          {PREMIUM_PLAN.features.map((f) => (
            <Text key={f} style={styles.featureIn}>✓  {f}</Text>
          ))}
        </View>
      </RNCard>

      <View style={{ marginTop: space[4] }}>
        <RNButton
          label={`Get Started — $${PREMIUM_PLAN.price}/mo`}
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(onboarding)/payment-setup' as never)}
        />
      </View>
    </ScrollView>
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
    lineHeight: typography.size.bodyLG * typography.lineHeight.relaxed,
  },
  eyebrow: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space[2], gap: space[1] },
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
});
