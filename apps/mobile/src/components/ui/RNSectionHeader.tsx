import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, space, typography } from '@/styles/appTokens';

export interface RNSectionHeaderProps {
  /** Always renders uppercase + gold + tracked. Don't pass uppercase yourself. */
  title: string;
  action?: { label: string; onPress: () => void };
}

export function RNSectionHeader({ title, action }: RNSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
  },
  title: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    color: palette.metal.rose,
    letterSpacing: typography.tracking.label,
  },
  action: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
    letterSpacing: typography.tracking.wide,
  },
});
