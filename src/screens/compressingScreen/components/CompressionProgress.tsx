import { StyleSheet, View } from 'react-native';

import {
  formatDurationWords,
  formatProgressPercent,
} from '../../../core/format';
import { ProgressBar } from '../../../features/compression/ProgressBar';
import type { CompressionJob } from '../../../features/compression/useCompressionJob';
import { spacing } from '../../../theme';
import { AppText } from '../../../ui';

/** The live half of the screen: percent, bar and times while running, the failure message after. */
export function CompressionProgress({
  job,
  tierLabel,
}: {
  job: CompressionJob;
  tierLabel: string;
}) {
  if (job.phase !== 'running') {
    return (
      <View style={styles.progress}>
        <AppText variant="bodyStrong" tone="danger">
          {job.message}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.progress}>
      <AppText variant="title">{formatProgressPercent(job.progress)}</AppText>
      <ProgressBar fraction={job.progress} />
      <AppText variant="caption" tone="muted">
        {`Compressing to ${tierLabel} · ${formatDurationWords(job.elapsedMs)} elapsed`}
      </AppText>
      <AppText variant="caption" tone="muted">
        {job.etaMs === null
          ? 'Estimating time remaining…'
          : `About ${formatDurationWords(job.etaMs)} left`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
});
