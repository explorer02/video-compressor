import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** Secondary line, e.g. "WhatsApp HD · ~14 MB". */
  detail?: string;
  disabled?: boolean;
  /** Shown instead of `detail` when the segment is disabled. */
  disabledReason?: string;
};

export type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/** Vertical segmented control — the tier picker needs two lines per option, so rows beat a strip. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.group}>
      {segments.map(segment => {
        const selected = segment.value === value;
        const detail = segment.disabled
          ? segment.disabledReason
          : segment.detail;

        return (
          <Pressable
            key={segment.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: segment.disabled }}
            disabled={segment.disabled}
            onPress={() => onChange(segment.value)}
            style={[
              styles.segment,
              selected ? styles.segmentSelected : null,
              segment.disabled ? styles.segmentDisabled : null,
            ]}
          >
            <AppText
              variant="bodyStrong"
              tone={selected ? 'accent' : 'default'}
            >
              {segment.label}
            </AppText>
            {detail ? (
              <AppText variant="caption" tone="muted">
                {detail}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  segment: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  segmentSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  segmentDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surface,
  },
});
