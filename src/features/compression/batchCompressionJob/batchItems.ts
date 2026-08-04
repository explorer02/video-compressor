/** Pure item math for the batch queue — no state, no I/O. */

import type { BatchPlan, BatchSaveAction } from '../../../app/flow/types';
import type { LibraryVideo } from '../../../core/videoLibrary';
import type { BatchItem } from './types';

export function pendingItem(
  video: LibraryVideo,
  action: BatchSaveAction
): BatchItem {
  return {
    video,
    action,
    phase: 'pending',
    progress: 0,
    sourceSizeBytes: null,
    outputSizeBytes: null,
    replaced: null,
    note: null,
  };
}

/** Batch replacements always keep the original's metadata (§3.4); copies follow the batch choice. */
export function saveModeFor(
  action: BatchSaveAction,
  copyMetadata: BatchPlan['copyMetadata']
): 'original' | 'fresh' {
  return action === 'replace' ? 'original' : copyMetadata;
}

/**
 * Duration-weighted whole-batch progress. Skipped and failed items stop occupying weight — their
 * slice of the bar would otherwise stay forever unfilled — and a batch with nothing left counts
 * as complete.
 */
export function overallOf(items: BatchItem[]): number {
  let total = 0;
  let done = 0;

  for (const item of items) {
    if (item.phase === 'skipped' || item.phase === 'failed') continue;
    const weight = item.video.durationMs ?? 1;
    total += weight;
    done += weight * itemProgress(item);
  }

  return total === 0 ? 1 : Math.min(done / total, 1);
}

function itemProgress(item: BatchItem): number {
  switch (item.phase) {
    case 'pending':
      return 0;
    case 'compressing':
      return item.progress;
    // Saving is a beat, not a stage worth its own bar — near-done is honest enough.
    case 'saving':
      return 0.98;
    default:
      return 1;
  }
}

export function savedBytesOf(items: BatchItem[]): number {
  return items.reduce((sum, item) => {
    if (
      item.phase !== 'done' ||
      item.sourceSizeBytes === null ||
      item.outputSizeBytes === null
    ) {
      return sum;
    }
    return sum + Math.max(0, item.sourceSizeBytes - item.outputSizeBytes);
  }, 0);
}
