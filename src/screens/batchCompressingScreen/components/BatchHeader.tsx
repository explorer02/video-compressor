import { StyleSheet, View } from 'react-native';

import {
  formatBytes,
  formatDurationWords,
  formatProgressPercent,
} from '../../../core/format';
import { ProgressBar } from '../../../features/compression/ProgressBar';
import type { BatchJob } from '../../../features/compression/batchCompressionJob';
import { colors, radius, spacing } from '../../../theme';
import { AppText } from '../../../ui';
import { activePosition, summaryLine } from '../utils';

/** The batch's headline per phase: live progress, the replace dialog notice, or the reckoning. */
export function BatchHeader({ job, total }: { job: BatchJob; total: number }) {
  if (job.phase === 'finished') {
    return (
      <View style={styles.header}>
        <AppText variant="title">
          {job.cancelled ? 'Batch cancelled' : 'All done'}
        </AppText>
        <AppText variant="body" tone="muted">
          {summaryLine(job)}
        </AppText>
      </View>
    );
  }

  if (job.phase === 'replacing') {
    return (
      <View style={styles.header}>
        <AppText variant="title">Replacing originals</AppText>
        <AppText variant="body" tone="muted">
          The system is asking to confirm deleting the originals you chose to
          replace.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <AppText variant="title">
        {`Compressing ${activePosition(job)} of ${total}`}
      </AppText>

      <View style={styles.progress}>
        <AppText variant="title">
          {formatProgressPercent(job.overallProgress)}
        </AppText>
        <ProgressBar fraction={job.overallProgress} />
        <AppText variant="caption" tone="muted">
          {`${formatDurationWords(job.elapsedMs)} elapsed · ${
            job.etaMs === null
              ? 'estimating time left…'
              : `about ${formatDurationWords(job.etaMs)} left`
          }`}
        </AppText>
        {job.savedBytes > 0 ? (
          <AppText variant="caption" tone="success">
            {`Saved ${formatBytes(job.savedBytes)} so far`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  progress: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
