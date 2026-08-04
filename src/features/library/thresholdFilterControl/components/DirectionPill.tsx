import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '../../../../theme';
import { AppText } from '../../../../ui';

export function DirectionPill({
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

const styles = StyleSheet.create({
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
});
