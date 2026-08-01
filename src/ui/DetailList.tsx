import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type DetailItem = { label: string; value: string };

export type DetailListProps = {
  items: DetailItem[];
  /** Optional caption above the rows, e.g. "ORIGINAL". */
  heading?: string;
};

/** Label-and-value rows on a card — the shape both the selected and preview screens use. */
export function DetailList({ items, heading }: DetailListProps) {
  return (
    <View style={styles.card}>
      {heading ? (
        <AppText variant="captionStrong" tone="muted">
          {heading}
        </AppText>
      ) : null}

      {items.map(item => (
        <View key={item.label} style={styles.row}>
          <AppText variant="caption" tone="muted">
            {item.label}
          </AppText>
          <AppText variant="caption" numberOfLines={1} style={styles.value}>
            {item.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  value: { flexShrink: 1, textAlign: 'right' },
});
