import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { thumbnailSource, type VideoAssetId } from '../../core/videoLibrary';
import { formatDurationClock } from '../../core/format';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../../ui';

export type VideoThumbnailProps = {
  assetId: VideoAssetId;
  durationMs?: number | null;
  style?: ViewStyle;
  /** Rounded corners are wrong for the full-bleed hero on the Selected screen. */
  rounded?: boolean;
};

/**
 * Poster frame for a video asset.
 *
 * The asset id is itself a URI both image pipelines understand (`content://` on Android,
 * `ph://` on iOS), and both serve it from the OS thumbnail cache instead of decoding the video —
 * which is what lets the list stay smooth at a thousand rows. Keeping that knowledge behind this
 * component means switching to a generated-thumbnail strategy is a one-file change.
 */
export function VideoThumbnail({
  assetId,
  durationMs,
  style,
  rounded = true,
}: VideoThumbnailProps) {
  return (
    <View
      style={[styles.frame, rounded ? styles.rounded : null, style]}
      accessible={false}
    >
      <Image
        source={thumbnailSource(assetId)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
      />
      {durationMs === undefined ? null : (
        <View style={styles.badge}>
          <AppText variant="caption" tone="inverted">
            {formatDurationClock(durationMs)}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.media,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  rounded: { borderRadius: radius.sm },
  badge: {
    margin: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
});
