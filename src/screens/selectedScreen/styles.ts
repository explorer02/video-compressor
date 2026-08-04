import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '../../theme';

export const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tiers: { gap: spacing.sm },
  actions: { padding: spacing.lg },
});
