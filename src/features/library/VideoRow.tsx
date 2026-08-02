import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatBytes, formatDate } from '../../core/format';
import type { LibraryVideo, VideoSortKey } from '../../core/videoLibrary';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';
import { VideoThumbnail } from './VideoThumbnail';

export const ROW_HEIGHT = 84;

/** Long enough not to fire while scrolling, short enough that a deliberate hold feels answered. */
const LONG_PRESS_MS = 220;

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
      accessibilityLabel={video.filename}
      accessibilityState={selecting ? { checked: selected } : undefined}
      onPress={() => onPress(video)}
      onLongPress={() => onLongPress(video)}
      delayLongPress={LONG_PRESS_MS}
      android_ripple={{ color: colors.surfaceSunken }}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
        selected ? styles.selected : null,
      ]}
    >
      {/* The check sits over the poster frame rather than beside it: entering selection mode must
          not reflow every row sideways, which is what made the transition feel like a jolt. */}
      <View style={styles.poster}>
        <VideoThumbnail
          assetId={video.id}
          durationMs={video.durationMs}
          style={styles.thumbnail}
        />
        {selecting ? <SelectionMark checked={selected} /> : null}
      </View>

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

function SelectionMark({ checked }: { checked: boolean }) {
  return (
    <View
      style={[styles.markLayer, checked ? styles.markLayerChecked : null]}
      pointerEvents="none"
    >
      <View style={[styles.mark, checked ? styles.markChecked : null]}>
        {checked ? (
          <AppText variant="captionStrong" tone="inverted">
            ✓
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function relevantDate(
  video: LibraryVideo,
  sortKey: VideoSortKey
): number | null {
  return sortKey === 'modifiedAt' ? video.modifiedAt : video.createdAt;
}

const THUMBNAIL_WIDTH = 96;
const THUMBNAIL_HEIGHT = 60;

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
  poster: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
  thumbnail: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
  details: { flex: 1, gap: 2 },
  markLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  /** Tinting the frame is what reads as "picked" at a glance, before the tick is even seen. */
  markLayerChecked: { backgroundColor: 'rgba(10, 102, 255, 0.35)' },
  mark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textInverted,
    backgroundColor: 'rgba(16, 17, 20, 0.35)',
  },
  markChecked: { backgroundColor: colors.accent },
});
