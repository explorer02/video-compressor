import { StyleSheet, View } from 'react-native';

import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../core/compression/types';
import { tierById } from '../core/compression/tiers';
import { formatDurationWords } from '../core/format';
import type { LibraryVideo } from '../core/videoLibrary';
import { ProgressBar } from '../features/compression/ProgressBar';
import { useCompressionJob } from '../features/compression/useCompressionJob';
import { VideoThumbnail } from '../features/library/VideoThumbnail';
import { spacing } from '../theme';
import { AppText, Button, Screen, useHardwareBack } from '../ui';

export type CompressingScreenProps = {
  video: LibraryVideo;
  source: SourceVideo;
  tier: QualityTierId;
  onCompleted: (outcome: CompressionOutcome) => void;
  onCancelled: () => void;
};

/** §3.3 — determinate progress, rough ETA, and a way out. The screen stays awake while it runs. */
export function CompressingScreen({
  video,
  source,
  tier,
  onCompleted,
  onCancelled,
}: CompressingScreenProps) {
  const { job, cancel } = useCompressionJob({
    video,
    source,
    tierId: tier,
    onCompleted,
    onCancelled,
  });

  // Hardware back means the same thing as the on-screen button: cancel, never abandon (§3.3).
  useHardwareBack(job.phase === 'running' ? cancel : onCancelled);

  return (
    <Screen>
      <View style={styles.content}>
        <VideoThumbnail assetId={video.id} style={styles.hero} />

        <AppText variant="heading" numberOfLines={1}>
          {video.filename}
        </AppText>

        {job.phase === 'running' ? (
          <View style={styles.progress}>
            <AppText variant="title">{`${Math.round(job.progress * 100)}%`}</AppText>
            <ProgressBar fraction={job.progress} />
            <AppText variant="caption" tone="muted">
              {`Compressing to ${tierById(tier).label} · ${formatDurationWords(job.elapsedMs)} elapsed`}
            </AppText>
            <AppText variant="caption" tone="muted">
              {job.etaMs === null
                ? 'Estimating time remaining…'
                : `About ${formatDurationWords(job.etaMs)} left`}
            </AppText>
          </View>
        ) : (
          <View style={styles.progress}>
            <AppText variant="bodyStrong" tone="danger">
              {job.message}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label={job.phase === 'running' ? 'Cancel' : 'Back'}
          variant={job.phase === 'running' ? 'secondary' : 'primary'}
          onPress={job.phase === 'running' ? cancel : onCancelled}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  progress: { gap: spacing.sm },
  actions: { padding: spacing.lg },
});
