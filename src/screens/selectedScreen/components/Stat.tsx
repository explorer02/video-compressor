import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../ui';

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, gap: 2 },
});
