import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '../../../features/compression/ProgressBar';
import type { BatchItem } from '../../../features/compression/batchCompressionJob';
import { VideoThumbnail } from '../../../features/library/VideoThumbnail';
import { spacing } from '../../../theme';
import { AppText } from '../../../ui';
import { itemBadge, itemBadgeTone, itemStatusLine } from '../utils';

/**
 * Memoized because the batch hook patches one item per progress tick while the rest keep their
 * reference identity — so a tick re-renders one row, not the whole list.
 */
export const BatchItemRow = memo(function BatchItemRow({
  item,
}: {
  item: BatchItem;
}) {
  return (
    <View style={styles.row}>
      <VideoThumbnail assetId={item.video.id} style={styles.thumbnail} />

      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.video.filename}
        </AppText>
        <AppText
          variant="caption"
          tone={item.phase === 'failed' ? 'danger' : 'muted'}
          numberOfLines={2}
        >
          {itemStatusLine(item)}
        </AppText>
      </View>

      {item.phase === 'compressing' ? (
        <View style={styles.rowProgress}>
          <ProgressBar fraction={item.progress} />
        </View>
      ) : (
        <AppText variant="bodyStrong" tone={itemBadgeTone(item)}>
          {itemBadge(item)}
        </AppText>
      )}
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
  thumbnail: { width: 56, height: 56 },
  rowBody: { flex: 1, gap: 2 },
  rowProgress: { width: 72 },
});
