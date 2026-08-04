import { StyleSheet } from 'react-native';

import { spacing } from '../../theme';

export const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  barSpacer: { width: 48 },
  actions: { padding: spacing.lg, gap: spacing.sm },
  replaceNote: { textAlign: 'center' },
});
