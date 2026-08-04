import { StyleSheet, View } from 'react-native';

import { formatBytes } from '../../../core/format';
import { colors, radius, spacing } from '../../../theme';
import { AppText } from '../../../ui';
import type { BatchTotals } from '../types';

export function TotalsCard({ totals }: { totals: BatchTotals }) {
  return (
    <View style={styles.totals}>
      <AppText variant="heading">
        {`${formatBytes(totals.sourceBytes)}  →  ~${formatBytes(totals.estimatedBytes)}`}
      </AppText>
      <AppText variant="caption" tone="muted">
        {[
          totals.savedLabel ? `saves ~${totals.savedLabel}` : null,
          totals.roughTime ? `roughly ${totals.roughTime}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
