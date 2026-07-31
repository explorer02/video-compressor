import { ScrollView, StyleSheet, View } from 'react-native';

import {
  formatBytes,
  formatDurationWords,
  formatResolution,
} from '../core/format';
import { sizeIndex } from '../core/sizeIndex';
import type { LibraryVideo } from '../core/videoLibrary';
import { VideoThumbnail } from '../features/library/VideoThumbnail';
import { colors, spacing } from '../theme';
import { AppText, Button, Screen } from '../ui';

export type SelectedScreenProps = {
  video: LibraryVideo;
  onBack: () => void;
};

/** §3.2 — the chosen video, its original stats, and the way back to the library. */
export function SelectedScreen({ video, onBack }: SelectedScreenProps) {
  const sizeBytes = sizeIndex.get(video);

  return (
    <Screen>
      <View style={styles.bar}>
        <Button label="Back" variant="ghost" onPress={onBack} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <VideoThumbnail assetId={video.id} style={styles.hero} />

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
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
  bar: { paddingHorizontal: spacing.sm, alignItems: 'flex-start' },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: spacing.md,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, gap: 2 },
});
