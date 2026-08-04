import { formatBytes } from '../../core/format';
import type {
  BatchItem,
  BatchJob,
} from '../../features/compression/batchCompressionJob';
import { plural } from '../../utils/text';

/** 1-based position of the item the encoder is on — settled items count as behind us. */
export function activePosition(job: BatchJob): number {
  const settled = job.items.filter(
    item =>
      item.phase === 'done' ||
      item.phase === 'skipped' ||
      item.phase === 'failed'
  ).length;
  return Math.min(settled + 1, job.items.length);
}

export function summaryLine(job: BatchJob): string {
  const parts = [
    `${job.compressedCount} ${plural(job.compressedCount, 'video')} compressed`,
  ];
  if (job.savedBytes > 0) parts.push(`saved ${formatBytes(job.savedBytes)}`);

  const failed = job.items.filter(item => item.phase === 'failed').length;
  if (failed > 0) parts.push(`${failed} failed`);

  return parts.join(' · ');
}

export function itemStatusLine(item: BatchItem): string {
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

export function itemBadge(item: BatchItem): string {
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

export function itemBadgeTone(
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

/** Keyed by the underlying asset, not the item object — items are re-created on every patch. */
export function batchItemKey(item: BatchItem): string {
  return item.video.id;
}
