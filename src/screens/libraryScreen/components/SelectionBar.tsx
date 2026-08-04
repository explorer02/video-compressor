import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../theme';
import { AppText, Button } from '../../../ui';

/**
 * Replaces the header while selecting: the count where the title was, the actions on one row.
 * "Delete" carries the count so the destructive button always says how much it will destroy.
 *
 * Memoized — every list or size-index update re-renders the screen, and this bar only depends on
 * the selection itself.
 */
export const SelectionBar = memo(function SelectionBar({
  count,
  allSelected,
  selectingAll,
  busy,
  onToggleAll,
  onCompress,
  onDelete,
  onDone,
}: {
  count: number;
  allSelected: boolean;
  selectingAll: boolean;
  busy: boolean;
  onToggleAll: () => void;
  onCompress: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.selectionBar}>
      <View style={styles.selectionTitle}>
        <AppText variant="title">
          {count === 0 ? 'Select' : String(count)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {count === 0 ? 'Tap videos to select them' : 'selected'}
        </AppText>
      </View>

      <View style={styles.selectionActions}>
        <Button
          label={allSelected ? 'Deselect all' : 'Select all'}
          variant="secondary"
          size="sm"
          busy={selectingAll}
          onPress={onToggleAll}
        />
        <Button
          label={count > 0 ? `Compress (${count})` : 'Compress'}
          size="sm"
          disabled={count === 0 || busy}
          onPress={onCompress}
        />
        <Button
          label={count > 0 ? `Delete (${count})` : 'Delete'}
          variant="danger"
          size="sm"
          busy={busy}
          disabled={count === 0}
          onPress={onDelete}
        />
        <Button label="Done" variant="ghost" size="sm" onPress={onDone} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  selectionBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  selectionTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    // The title line keeps the header's height so flipping modes never shifts the list below.
    minHeight: 34,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
