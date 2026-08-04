import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { FilterDirection } from '../../../core/videoLibrary';
import { colors, radius, spacing } from '../../../theme';
import { AppText } from '../../../ui';
import { DirectionPill } from './components/DirectionPill';
import { FilterOption } from './components/FilterOption';
import type { ThresholdFilterControlProps } from './types';
import { thresholdFilterLabel } from './utils';

/**
 * The unit-agnostic core of the size and duration filters: a chip that names the active filter
 * and opens a sheet of direction pills and thresholds. Wrappers supply the unit — thresholds,
 * formatting, and the "no filter" wording — so a new filter dimension is a thin adapter, not
 * another copy of this sheet.
 */

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
});
