import { ScrollView, View } from 'react-native';

import type { QualityTierId, SourceVideo } from '../../core/compression/types';
import {
  formatBytes,
  formatDateTime,
  formatDurationWords,
  formatFolder,
  formatResolution,
} from '../../core/format';
import { playbackSource, type LibraryVideo } from '../../core/videoLibrary';
import { TierSelector } from '../../features/compression/TierSelector';
import {
  AppText,
  Banner,
  Button,
  DetailList,
  Screen,
  VideoStage,
} from '../../ui';
import { Stat } from './components/Stat';
import { styles } from './styles';
import { useSelectedScreen } from './useSelectedScreen';

export type SelectedScreenProps = {
  video: LibraryVideo;
  onBack: () => void;
  onStart: (source: SourceVideo, tier: QualityTierId) => void;
};

/** §3.2 — the chosen video, its original stats, and the quality tier to compress it to. */
export function SelectedScreen(props: SelectedScreenProps) {
  const { video, onBack } = props;
  const {
    details,
    sizeBytes,
    facts,
    tier,
    setTier,
    optimized,
    start,
    resolving,
    deletion,
  } = useSelectedScreen(props);

  return (
    <Screen>
      <View style={styles.bar}>
        <Button label="Back" variant="ghost" onPress={onBack} />
        {/* Lives in the bar, not the action row, so a redundant video can be deleted even when
            it is already optimized and there is nothing to compress. */}
        <Button
          label="Delete"
          variant="danger"
          busy={deletion.busy}
          disabled={resolving}
          onPress={() => deletion.remove([video])}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <VideoStage source={playbackSource(video.id)} />

        <AppText variant="heading" numberOfLines={2}>
          {video.filename}
        </AppText>

        <View style={styles.stats}>
          <Stat
            label="Resolution"
            value={formatResolution(video.width, video.height)}
          />
          <Stat
            label="Duration"
            value={formatDurationWords(video.durationMs)}
          />
          <Stat
            label="Size"
            value={sizeBytes === null ? '—' : formatBytes(sizeBytes)}
          />
        </View>

        <DetailList
          items={[
            { label: 'Created', value: formatDateTime(details.capturedAt) },
            { label: 'Modified', value: formatDateTime(details.modifiedAt) },
            { label: 'Folder', value: formatFolder(details.folder) },
          ]}
        />

        {optimized ? (
          <Banner message="Already optimized — compressing this video would not make it smaller." />
        ) : (
          <View style={styles.tiers}>
            <AppText variant="captionStrong" tone="muted">
              QUALITY
            </AppText>
            <TierSelector facts={facts} value={tier} onChange={setTier} />
          </View>
        )}
      </ScrollView>

      {optimized ? null : (
        <View style={styles.actions}>
          <Button
            label={resolving ? 'Preparing video…' : 'Compress'}
            onPress={start}
            disabled={tier === null}
            busy={resolving}
          />
        </View>
      )}
    </Screen>
  );
}
