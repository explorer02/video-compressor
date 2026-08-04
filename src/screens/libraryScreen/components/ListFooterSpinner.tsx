import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../../theme';

/** Sits under the last row while the next page loads. */
export function ListFooterSpinner() {
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
