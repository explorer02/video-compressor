import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BatchPlan } from '../app/flow/types';
import { formatBytes, formatDurationWords } from '../core/format';
import { ProgressBar } from '../features/compression/ProgressBar';
import {
  useBatchCompressionJob,
  type BatchItem,
  type BatchJob,
} from '../features/compression/useBatchCompressionJob';
import { VideoThumbnail } from '../features/library/VideoThumbnail';
import { colors, radius, spacing } from '../theme';
import { AppText, Button, Screen, useHardwareBack } from '../ui';

/**
 * The batch in motion, then its reckoning — one screen, because the list of videos is the story in
 * both phases: what each row is doing now, and afterwards, what each one became.
 */

export type BatchCompressingScreenProps = {
  plan: BatchPlan;
  onDone: () => void;
};

export function BatchCompressingScreen({
  plan,
  onDone,
}: BatchCompressingScreenProps) {
  const job = useBatchCompressionJob(plan);
  const running = job.phase !== 'finished';

  // While running, back means the same as Cancel: stop the queue, never abandon it silently.
  useHardwareBack(running ? job.cancel : onDone);

  const renderItem = useCallback(
    ({ item }: { item: BatchItem }) => <BatchItemRow item={item} />,
    []
  );

  return (
    <Screen>
      <FlashList
        data={job.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={job.items}
        ListHeaderComponent={<BatchHeader job={job} total={plan.items.length} />}
      />

      <View style={styles.actions}>
        {running ? (
          <>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={job.cancel}
              disabled={job.cancelled}
            />
            <AppText variant="caption" tone="muted" style={styles.centered}>
              Videos already finished stay saved.
            </AppText>
          </>
        ) : (
          <Button label="Done" onPress={onDone} />
        )}
      </View>
    </Screen>
  );
}

function BatchHeader({ job, total }: { job: BatchJob; total: number }) {
  if (job.phase === 'finished') {
    return (
      <View style={styles.header}>
        <AppText variant="title">
          {job.cancelled ? 'Batch cancelled' : 'All done'}
        </AppText>
        <AppText variant="body" tone="muted">
          {summaryLine(job)}
        </AppText>
      </View>
    );
  }

  if (job.phase === 'replacing') {
    return (
      <View style={styles.header}>
        <AppText variant="title">Replacing originals</AppText>
        <AppText variant="body" tone="muted">
          The system is asking to confirm deleting the originals you chose to
          replace.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <AppText variant="title">
        {`Compressing ${activePosition(job)} of ${total}`}
      </AppText>

      <View style={styles.progress}>
        <AppText variant="title">
          {`${Math.round(job.overallProgress * 100)}%`}
        </AppText>
        <ProgressBar fraction={job.overallProgress} />
        <AppText variant="caption" tone="muted">
          {`${formatDurationWords(job.elapsedMs)} elapsed · ${
            job.etaMs === null
              ? 'estimating time left…'
              : `about ${formatDurationWords(job.etaMs)} left`
          }`}
        </AppText>
        {job.savedBytes > 0 ? (
          <AppText variant="caption" tone="success">
            {`Saved ${formatBytes(job.savedBytes)} so far`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function BatchItemRow({ item }: { item: BatchItem }) {
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
}

/** 1-based position of the item the encoder is on — settled items count as behind us. */
function activePosition(job: BatchJob): number {
  const settled = job.items.filter(
    item =>
      item.phase === 'done' ||
      item.phase === 'skipped' ||
      item.phase === 'failed'
  ).length;
  return Math.min(settled + 1, job.items.length);
}

function summaryLine(job: BatchJob): string {
  const parts = [
    `${job.compressedCount} ${job.compressedCount === 1 ? 'video' : 'videos'} compressed`,
  ];
  if (job.savedBytes > 0) parts.push(`saved ${formatBytes(job.savedBytes)}`);

  const failed = job.items.filter(item => item.phase === 'failed').length;
  if (failed > 0) parts.push(`${failed} failed`);

  return parts.join(' · ');
}

function itemStatusLine(item: BatchItem): string {
  switch (item.phase) {
    case 'pending':
      return 'Waiting';
    case 'compressing':
      return `Compressing · ${Math.round(item.progress * 100)}%`;
    case 'saving':
      return 'Saving…';
    case 'skipped':
      return item.note ?? 'Skipped';
    case 'failed':
      return item.note ?? 'Failed';
    case 'done':
      return doneStatusLine(item);
  }
}

function doneStatusLine(item: BatchItem): string {
  const sizes =
    item.sourceSizeBytes !== null && item.outputSizeBytes !== null
      ? `${formatBytes(item.sourceSizeBytes)} → ${formatBytes(item.outputSizeBytes)}`
      : null;

  return [sizes, doneOutcomeWord(item)].filter(Boolean).join(' · ');
}

/** What actually happened to this video — never claims a replace the system didn't confirm. */
function doneOutcomeWord(item: BatchItem): string {
  if (item.action === 'copy') return 'copy saved';
  if (item.replaced === true) return 'replaced';
  if (item.replaced === false) return 'copy saved — original kept';
  return 'copy saved';
}

function itemBadge(item: BatchItem): string {
  switch (item.phase) {
    case 'done':
      return '✓';
    case 'failed':
      return '✕';
    case 'skipped':
      return '—';
    case 'saving':
      return '…';
    default:
      return '';
  }
}

function itemBadgeTone(
  item: BatchItem
): 'success' | 'danger' | 'muted' | 'default' {
  switch (item.phase) {
    case 'done':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'muted';
  }
}

function keyExtractor(item: BatchItem): string {
  return item.video.id;
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  progress: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
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
  actions: { padding: spacing.lg, gap: spacing.sm },
  centered: { textAlign: 'center' },
});
