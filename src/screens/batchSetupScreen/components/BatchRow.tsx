import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BatchSaveAction } from '../../../app/flow/types';
import type { TierEligibility } from '../../../core/compression/tiers';
import type { LibraryVideo } from '../../../core/videoLibrary';
import { VideoThumbnail } from '../../../features/library/VideoThumbnail';
import { spacing } from '../../../theme';
import { AppText } from '../../../ui';
import { rowMeta, rowVerdict } from '../utils';
import { ActionPill } from './ActionPill';

/**
 * Memoized — flipping one row's Copy/Replace rebuilds the actions map, but every other row keeps
 * the same props (`onAction` is stable), so only the flipped row re-renders.
 */
export const BatchRow = memo(function BatchRow({
  video,
  verdict,
  action,
  onAction,
}: {
  video: LibraryVideo;
  verdict: TierEligibility | undefined;
  action: BatchSaveAction;
  onAction: (video: LibraryVideo, action: BatchSaveAction) => void;
}) {
  const eligible = verdict?.eligible === true;

  return (
    <View style={styles.row}>
      <VideoThumbnail
        assetId={video.id}
        durationMs={video.durationMs}
        style={styles.thumbnail}
      />

      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {video.filename}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {rowMeta(video)}
        </AppText>
        <AppText
          variant="caption"
          tone={eligible ? 'accent' : 'muted'}
          numberOfLines={1}
        >
          {rowVerdict(verdict)}
        </AppText>
      </View>

      {eligible ? (
        <View style={styles.rowActions}>
          <ActionPill
            label="Copy"
            selected={action === 'copy'}
            onPress={() => onAction(video, 'copy')}
          />
          <ActionPill
            label="Replace"
            selected={action === 'replace'}
            onPress={() => onAction(video, 'replace')}
          />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  thumbnail: { width: 64, height: 64 },
  rowBody: { flex: 1, gap: 2 },
  rowActions: { gap: spacing.xs },
});
