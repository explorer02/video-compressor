import { StyleSheet, View } from 'react-native';

import { formatBytes, formatSavingPercent } from '../../../core/format';
import { colors, radius, spacing } from '../../../theme';
import { AppText } from '../../../ui';

/** Original next to compressed, with the saving spelled out under them. */
export function SizeComparison({
  sourceBytes,
  outputBytes,
}: {
  sourceBytes: number;
  outputBytes: number;
}) {
  const saved = formatSavingPercent(sourceBytes, outputBytes);

  return (
    <>
      <View style={styles.comparison}>
        <Measure label="Original" value={formatBytes(sourceBytes)} />
        <Measure
          label="Compressed"
          value={formatBytes(outputBytes)}
          tone="success"
        />
      </View>

      {saved ? (
        <AppText variant="bodyStrong" tone="success" style={styles.saved}>
          {`${saved} smaller`}
        </AppText>
      ) : null}
    </>
  );
}

function Measure({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success';
}) {
  return (
    <View style={styles.measure}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading" tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  comparison: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  measure: { flex: 1, gap: 2 },
  saved: { textAlign: 'center' },
});
