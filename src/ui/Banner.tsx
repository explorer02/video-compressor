import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type BannerProps = {
  message: string;
  action?: { label: string; onPress: () => void };
};

/** Persistent inline notice — used for partial media access and stale-library warnings. */
export function Banner({ message, action }: BannerProps) {
  return (
    <View style={styles.root}>
      <AppText variant="caption" style={styles.message}>
        {message}
      </AppText>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={spacing.sm}
        >
          <AppText variant="captionStrong" tone="accent">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  message: { flex: 1, color: colors.warning },
});
