import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { formatBytes } from '../../core/format';
import { SIZE_FILTERS, type SizeFilter } from '../../core/videoLibrary';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';

export type SizeFilterControlProps = {
  value: SizeFilter;
  disabled?: boolean;
  onChange: (filter: SizeFilter) => void;
};

/**
 * Hides videos below a chosen size (§4).
 *
 * A sheet rather than inline options: nine thresholds would not fit across a phone, and the active
 * one is worth showing as a label anyway so a filtered list never looks like a short library.
 */
export function SizeFilterControl({
  value,
  disabled = false,
  onChange,
}: SizeFilterControlProps) {
  const [open, setOpen] = useState(false);

  const choose = (filter: SizeFilter) => {
    onChange(filter);
    setOpen(false);
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
          {labelFor(value)}
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
              SHOW VIDEOS OF AT LEAST
            </AppText>

            {SIZE_FILTERS.map(filter => (
              <Pressable
                key={String(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                onPress={() => choose(filter)}
                style={({ pressed }) => [
                  styles.option,
                  pressed ? styles.optionPressed : null,
                ]}
              >
                <AppText
                  variant={filter === value ? 'bodyStrong' : 'body'}
                  tone={filter === value ? 'accent' : 'default'}
                >
                  {labelFor(filter)}
                </AppText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function labelFor(filter: SizeFilter): string {
  return filter === null ? 'Any size' : `≥ ${formatBytes(filter)}`;
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
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionPressed: { backgroundColor: colors.surface },
});
