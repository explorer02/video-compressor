import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatBytes, formatDate } from '../../core/format';
import type { LibraryVideo, VideoSortKey } from '../../core/videoLibrary';
import { colors, spacing } from '../../theme';
import { AppText } from '../../ui';
import { VideoThumbnail } from './VideoThumbnail';

export const ROW_HEIGHT = 84;

export type VideoRowProps = {
  video: LibraryVideo;
  /** Rows show the date the list is sorted by, so the ordering is always legible. */
  sortKey: VideoSortKey;
  sizeBytes: number | null;
  onPress: (video: LibraryVideo) => void;
};

export const VideoRow = memo(function VideoRow({
  video,
  sortKey,
  sizeBytes,
  onPress,
}: VideoRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(video)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <VideoThumbnail
        assetId={video.id}
        durationMs={video.durationMs}
        style={styles.thumbnail}
      />
      <View style={styles.details}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {video.filename}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {[
            sizeBytes === null ? null : formatBytes(sizeBytes),
            formatDate(relevantDate(video, sortKey)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
    </Pressable>
  );
});

function relevantDate(
  video: LibraryVideo,
  sortKey: VideoSortKey
): number | null {
  return sortKey === 'modifiedAt' ? video.modifiedAt : video.createdAt;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.surface },
  thumbnail: { width: 96, height: 60 },
  details: { flex: 1, gap: 2 },
});
