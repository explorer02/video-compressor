import { StyleSheet } from 'react-native';

import { spacing } from '../../theme';

export const styles = StyleSheet.create({
  // Sort options and filter chips each get a full row — three sort labels plus two chips never
  // fit one row without truncating into "File …" / "Date…".
  controls: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
