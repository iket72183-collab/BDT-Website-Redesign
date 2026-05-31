import { StyleSheet, Text, View } from 'react-native';
import { palette, space, typography } from '@/styles/appTokens';
import { Icon } from './icons';
import type { ComponentProps } from 'react';

export interface RNEmptyStateProps {
  /** Feather icon name. Stays thin-line, gold-tinted. */
  icon?: ComponentProps<typeof Icon>['name'];
  title: string;
  /** Subtext — keep elegant. "No bookings today. Enjoy the quiet." > "Nothing here." */
  body?: string;
  action?: React.ReactNode;
}

export function RNEmptyState({ icon = 'circle', title, body, action }: RNEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={28} color={palette.metal.rose} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {action && <View style={{ marginTop: space[5] }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[10],
    paddingHorizontal: space[6],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 168, 130, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.4)',
  },
  title: {
    marginTop: space[4],
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displaySM,
    color: palette.ink.primary,
    textAlign: 'center',
  },
  body: {
    marginTop: space[2],
    fontFamily: typography.family.body,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
