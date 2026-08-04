import { View } from 'react-native';

import { tierById } from '../../core/compression/tiers';
import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import type { LibraryVideo } from '../../core/videoLibrary';
import { useCompressionJob } from '../../features/compression/useCompressionJob';
import { VideoThumbnail } from '../../features/library/VideoThumbnail';
import { AppText, Button, Screen, useHardwareBack } from '../../ui';
import { CompressionProgress } from './components/CompressionProgress';
import { styles } from './styles';

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

        <CompressionProgress job={job} tierLabel={tierById(tier).label} />
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
