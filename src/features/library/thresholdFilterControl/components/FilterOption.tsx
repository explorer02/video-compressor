import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '../../../../theme';
import { AppText } from '../../../../ui';

export function FilterOption({
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
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionPressed: { backgroundColor: colors.surface },
});
