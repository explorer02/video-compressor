import { StyleSheet } from 'react-native';

import { spacing } from '../../theme';

export const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  actions: { padding: spacing.lg },
});
