import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatBytes, formatDate } from '../../core/format';
import type { LibraryVideo, VideoSortKey } from '../../core/videoLibrary';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';
import { VideoThumbnail } from './VideoThumbnail';

export const ROW_HEIGHT = 84;

export type VideoRowProps = {
  video: LibraryVideo;
  /** Rows show the date the list is sorted by, so the ordering is always legible. */
  sortKey: VideoSortKey;
  sizeBytes: number | null;
  /** Null when the browser is not in selection mode. */
  selected: boolean | null;
  onPress: (video: LibraryVideo) => void;
  onLongPress: (video: LibraryVideo) => void;
};

export const VideoRow = memo(function VideoRow({
  video,
  sortKey,
  sizeBytes,
  selected,
  onPress,
  onLongPress,
}: VideoRowProps) {
  const selecting = selected !== null;

  return (
    <Pressable
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      onPress={() => onPress(video)}
      onLongPress={() => onLongPress(video)}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
        selected ? styles.selected : null,
      ]}
    >
      {selecting ? <Checkbox checked={selected} /> : null}

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

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked ? styles.checkboxOn : null]}>
      {checked ? (
        <AppText variant="captionStrong" tone="inverted">
          ✓
        </AppText>
      ) : null}
    </View>
  );
}

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
  selected: { backgroundColor: colors.accentSoft },
  thumbnail: { width: 96, height: 60 },
  details: { flex: 1, gap: 2 },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
