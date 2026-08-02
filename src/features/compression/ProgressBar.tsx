import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../../theme';

const HEIGHT = 8;

export function ProgressBar({ fraction }: { fraction: number }) {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  // Tenth-of-a-percent steps so the fill creeps rather than jumps (§3.3).
  const percent = `${Math.round(clamped * 1000) / 10}%` as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
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
