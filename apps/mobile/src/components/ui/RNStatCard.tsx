import { StyleSheet, Text, View } from 'react-native';
import { palette, space, typography } from '@/styles/appTokens';
import { RNCard } from './RNCard';

export interface RNStatCardProps {
  label: string;
  value: string | number;
  /** "+12.4%" or "−3" — rendered green/red automatically based on the sign. */
  trend?: string;
  trendDirection?: 'up' | 'down' | 'flat';
  /** Optional icon to the right of the value. */
  icon?: React.ReactNode;
}

export function RNStatCard({ label, value, trend, trendDirection, icon }: RNStatCardProps) {
  const trendColor =
    trendDirection === 'up'
      ? palette.status.success
      : trendDirection === 'down'
        ? '#C46868'
        : palette.ink.muted;

  return (
    <RNCard variant="metric" style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{value}</Text>
        {icon}
      </View>
      {trend && <Text style={[styles.trend, { color: trendColor }]}>{trend}</Text>}
    </RNCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.caption,
    letterSpacing: typography.tracking.label,
    textTransform: 'uppercase',
    color: palette.ink.muted,
  },
  row: {
    marginTop: space[2],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[2],
  },
  value: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayLG,
    color: palette.metal.rose,
    letterSpacing: typography.tracking.tight,
  },
  trend: {
    marginTop: space[2],
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodySM,
    letterSpacing: typography.tracking.wide,
  },
});
