import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { FilterDirection } from '../../core/videoLibrary';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';

/**
 * The unit-agnostic core of the size and duration filters: a chip that names the active filter
 * and opens a sheet of direction pills and thresholds. Wrappers supply the unit — thresholds,
 * formatting, and the "no filter" wording — so a new filter dimension is a thin adapter, not
 * another copy of this sheet.
 */

export type ThresholdFilter = {
  direction: FilterDirection;
  threshold: number;
} | null;

export type ThresholdFilterControlProps = {
  value: ThresholdFilter;
  /** Offered cut-offs, ascending, in whatever unit `formatThreshold` renders. */
  thresholds: number[];
  /** Chip and sheet wording when no filter is active, e.g. "Any size". */
  anyLabel: string;
  formatThreshold: (threshold: number) => string;
  /** Direction the sheet opens with before any filter exists. */
  defaultDirection?: FilterDirection;
  disabled?: boolean;
  onChange: (filter: ThresholdFilter) => void;
};

/** The chip and sheet share one wording for a filter, so the list always reads as filtered. */
export function thresholdFilterLabel(
  filter: ThresholdFilter,
  anyLabel: string,
  formatThreshold: (threshold: number) => string
): string {
  if (filter === null) return anyLabel;
  const sign = filter.direction === 'atLeast' ? '≥' : '<';
  return `${sign} ${formatThreshold(filter.threshold)}`;
}

/**
 * Keeps videos on one side of a chosen threshold (§4) — at least it, for finding what is worth
 * acting on, or under it, for checking what already fits.
 *
 * A sheet rather than inline options: the thresholds would not fit across a phone, and the active
 * one is worth showing as a label anyway so a filtered list never looks like a short library.
 */
export function ThresholdFilterControl({
  value,
  thresholds,
  anyLabel,
  formatThreshold,
  defaultDirection = 'atLeast',
  disabled = false,
  onChange,
}: ThresholdFilterControlProps) {
  const [open, setOpen] = useState(false);
  // The sheet's direction outlives any one threshold pick, so flipping it re-aims the current
  // filter instead of resetting it.
  const [direction, setDirection] = useState<FilterDirection>(
    value?.direction ?? defaultDirection
  );

  const choose = (threshold: number | null) => {
    onChange(threshold === null ? null : { direction, threshold });
    setOpen(false);
  };

  const flipDirection = (next: FilterDirection) => {
    setDirection(next);
    // An active filter follows the flip immediately — the sheet stays open for a threshold change.
    if (value !== null)
      onChange({ direction: next, threshold: value.threshold });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          value !== null ? styles.triggerActive : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <AppText
          variant="captionStrong"
          tone={value === null ? 'muted' : 'accent'}
          numberOfLines={1}
        >
          {thresholdFilterLabel(value, anyLabel, formatThreshold)}
        </AppText>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet}>
            <AppText variant="captionStrong" tone="muted">
              SHOW VIDEOS THAT ARE
            </AppText>

            <View style={styles.directions}>
              <DirectionPill
                label="At least"
                selected={direction === 'atLeast'}
                onPress={() => flipDirection('atLeast')}
              />
              <DirectionPill
                label="Under"
                selected={direction === 'under'}
                onPress={() => flipDirection('under')}
              />
            </View>

            <FilterOption
              label={anyLabel}
              selected={value === null}
              onPress={() => choose(null)}
            />
            {thresholds.map(threshold => (
              <FilterOption
                key={threshold}
                label={thresholdFilterLabel(
                  { direction, threshold },
                  anyLabel,
                  formatThreshold
                )}
                selected={value?.threshold === threshold}
                onPress={() => choose(threshold)}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function DirectionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected ? styles.pillSelected : null]}
    >
      <AppText variant="captionStrong" tone={selected ? 'accent' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        pressed ? styles.optionPressed : null,
      ]}
    >
      <AppText
        variant={selected ? 'bodyStrong' : 'body'}
        tone={selected ? 'accent' : 'default'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  triggerActive: { backgroundColor: colors.accentSoft },
  disabled: { opacity: 0.45 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.background,
  },
  directions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionPressed: { backgroundColor: colors.surface },
});
