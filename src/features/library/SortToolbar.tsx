import { Pressable, StyleSheet, View } from 'react-native';

import type { VideoSort, VideoSortKey } from '../../core/videoLibrary';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';

type SortOption = { key: VideoSortKey; label: string };

const OPTIONS: SortOption[] = [
  { key: 'size', label: 'File size' },
  { key: 'createdAt', label: 'Date created' },
  { key: 'modifiedAt', label: 'Date modified' },
];

export type SortToolbarProps = {
  sort: VideoSort;
  sizeSortAvailable: boolean;
  onToggle: (key: VideoSortKey) => void;
};

/** Tapping the active option reverses it; the arrow shows which way (§4). */
export function SortToolbar({
  sort,
  sizeSortAvailable,
  onToggle,
}: SortToolbarProps) {
  return (
    <View style={styles.bar}>
      {OPTIONS.map(option => {
        const active = option.key === sort.key;
        const disabled = option.key === 'size' && !sizeSortAvailable;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            accessibilityHint={
              disabled ? 'Indexing sizes is not available yet' : undefined
            }
            disabled={disabled}
            onPress={() => onToggle(option.key)}
            style={[
              styles.option,
              active ? styles.optionActive : null,
              disabled ? styles.optionDisabled : null,
            ]}
          >
            <AppText
              variant="captionStrong"
              tone={active ? 'accent' : 'muted'}
              numberOfLines={1}
            >
              {option.label}
              {active ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  optionActive: { backgroundColor: colors.accentSoft },
  optionDisabled: { opacity: 0.45 },
});
