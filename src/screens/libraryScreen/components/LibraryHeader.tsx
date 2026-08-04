import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../theme';
import { AppText } from '../../../ui';

export function LibraryHeader({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="title">Videos</AppText>
      <AppText variant="caption" tone="muted">
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
});
