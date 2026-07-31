import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../../theme';

const HEIGHT = 8;

export function ProgressBar({ fraction }: { fraction: number }) {
  const percent =
    `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%` as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(fraction * 100), min: 0, max: 100 }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: percent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
