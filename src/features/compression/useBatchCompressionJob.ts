import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';

import type { BatchPlan, BatchSaveAction } from '../../app/flow/types';
import {
  beginBackgroundSession,
  ensureNotificationPermission,
} from '../../core/background';
import { runCompressionJob } from '../../core/compression/runJob';
import {
  estimateOutputBytes,
  evaluateTier,
  tierById,
} from '../../core/compression/tiers';
import { formatDurationWords } from '../../core/format';
import { readSourceVideo } from '../../core/metadata';
import type { LibraryVideo } from '../../core/videoLibrary';
import { assetExists, deleteAssets } from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';
import { saveCompressedCopy } from '../outcome/saveOutcome';

/**
 * The batch queue: one hardware-encoder session at a time, each finished video saved before the
 * next starts, and — after the last encode — a single system dialog for every original marked
 * Replace. Outputs are always safe in the gallery before any delete is requested, so no failure
 * mode can cost the user a video.
 */

const TICK_MS = 500;

/** Below this the overall ETA swings wildly; the screen shows "estimating" instead. */
const MIN_PROGRESS_FOR_ETA = 0.03;

export type BatchItemPhase =
  'pending' | 'compressing' | 'saving' | 'done' | 'skipped' | 'failed';

export type BatchItem = {
  video: LibraryVideo;
  action: BatchSaveAction;
  phase: BatchItemPhase;
  /** 0–1, meaningful while compressing. */
  progress: number;
  sourceSizeBytes: number | null;
  outputSizeBytes: number | null;
  /** Replace items only: null until the system dialog resolves, then whether it really happened. */
  replaced: boolean | null;
  /** Why the item was skipped or failed. */
  note: string | null;
};

export type BatchJobPhase = 'running' | 'replacing' | 'finished';

export type BatchJob = {
  items: BatchItem[];
  phase: BatchJobPhase;
  /** True when the user stopped the queue early; finished items are already saved. */
  cancelled: boolean;
  /** Duration-weighted, across the whole batch. */
  overallProgress: number;
  elapsedMs: number;
  etaMs: number | null;
  savedBytes: number;
  compressedCount: number;
  cancel: () => void;
};

export function useBatchCompressionJob(plan: BatchPlan): BatchJob {
  useKeepAwake();

  const [items, setItems] = useState<BatchItem[]>(() =>
    plan.items.map(({ video, action }) => pendingItem(video, action))
  );
  const [phase, setPhase] = useState<BatchJobPhase>('running');
  const [cancelledState, setCancelledState] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // The queue loop lives outside React's render cycle; these refs are its view of the world.
  const itemsRef = useRef(items);
  const cancelledRef = useRef(false);
  const cancelCurrent = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    setCancelledState(true);
    cancelCurrent.current?.();
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    const patchItem = (index: number, patch: Partial<BatchItem>) => {
      itemsRef.current = itemsRef.current.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      );
      if (active) setItems(itemsRef.current);
    };

    const notificationTimes = () => {
      const elapsed = Date.now() - startedAt;
      const eta = estimateEta(elapsed, overallOf(itemsRef.current));
      return {
        elapsed: `${formatDurationWords(elapsed)} elapsed`,
        remaining:
          eta === null ? 'Estimating…' : `${formatDurationWords(eta)} left`,
      };
    };

    void ensureNotificationPermission();

    // One service session spans the whole batch; each item re-titles the notification instead.
    // Cycling the service per item raced the platform's startForeground obligation and got the
    // app killed with ForegroundServiceDidNotStartInTimeException (see beginBackgroundSession).
    const itemTitle = (index: number) =>
      `Compressing ${index + 1} of ${plan.items.length} — ${plan.items[index].video.filename}`;
    const background = beginBackgroundSession(itemTitle(0));

    const ticker = setInterval(() => {
      if (active) setElapsedMs(Date.now() - startedAt);
    }, TICK_MS);

    const compressOne = async (index: number): Promise<void> => {
      const { video, action } = plan.items[index];

      try {
        const source = await readSourceVideo(video);
        const tier = tierById(plan.tier);

        // The setup screen judged eligibility from cheap library facts; the resolved source knows
        // the real size and frame rate, so re-judge before spending an encode on it.
        const verdict = evaluateTier(tier, source);
        if (!verdict.eligible) {
          patchItem(index, {
            phase: 'skipped',
            note: verdict.reason,
            sourceSizeBytes: source.sizeBytes,
          });
          return;
        }

        if (
          source.sizeBytes > 0 &&
          estimateOutputBytes(tier, source) !== null
        ) {
          if (!workspace.hasRoomFor(estimateOutputBytes(tier, source))) {
            patchItem(index, {
              phase: 'failed',
              note: 'Not enough free space',
              sourceSizeBytes: source.sizeBytes,
            });
            return;
          }
        }

        workspace.markJobStarted({
          assetId: source.assetId,
          tierId: plan.tier,
          startedAt: Date.now(),
          batch: { index: index + 1, total: plan.items.length },
        });
        patchItem(index, {
          phase: 'compressing',
          progress: 0,
          sourceSizeBytes: source.sizeBytes,
        });
        background.update(
          overallOf(itemsRef.current),
          notificationTimes(),
          itemTitle(index)
        );

        const run = runCompressionJob(video, source, plan.tier, fraction => {
          patchItem(index, { progress: clampProgress(fraction) });
          background.update(
            overallOf(itemsRef.current),
            notificationTimes(),
            itemTitle(index)
          );
        });
        cancelCurrent.current = run.cancel;
        const outcome = await run.outcome;
        cancelCurrent.current = null;

        patchItem(index, { phase: 'saving', progress: 1 });
        await saveCompressedCopy(
          outcome,
          saveModeFor(action, plan.copyMetadata)
        );
        patchItem(index, {
          phase: 'done',
          outputSizeBytes: outcome.outputSizeBytes,
        });
      } finally {
        cancelCurrent.current = null;
        workspace.markJobFinished();
      }
    };

    void (async () => {
      for (let index = 0; index < plan.items.length; index++) {
        if (cancelledRef.current) {
          patchItem(index, { phase: 'skipped', note: 'Cancelled' });
          continue;
        }

        try {
          await compressOne(index);
        } catch (error) {
          if (cancelledRef.current) {
            patchItem(index, { phase: 'skipped', note: 'Cancelled' });
          } else {
            // One bad video must not sink the queue — record why and move on (§10).
            patchItem(index, { phase: 'failed', note: describe(error) });
          }
        }
      }

      // Encoding is over; the delete dialog needs no service or notification behind it.
      background.end();

      // §3.4 for batches: every original marked Replace goes into ONE system delete dialog, and
      // only after its compressed copy is safely in the gallery. A denied dialog costs nothing —
      // the copies stay, and the items report their originals as kept.
      const replacements = itemsRef.current
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) => item.action === 'replace' && item.phase === 'done'
        );

      if (!cancelledRef.current && replacements.length > 0) {
        if (active) setPhase('replacing');
        try {
          await deleteAssets(replacements.map(({ item }) => item.video.id));
        } catch (error) {
          console.warn('[batch] delete request failed', error);
        }
        for (const { item, index } of replacements) {
          patchItem(index, {
            replaced: !(await originalSurvived(item.video.id)),
          });
        }
      }

      if (active) setPhase('finished');
    })();

    return () => {
      active = false;
      clearInterval(ticker);
      // Unmounting mid-run must not leave the encoder running headless.
      cancelledRef.current = true;
      cancelCurrent.current?.();
      background.end();
      workspace.markJobFinished();
    };
  }, [plan]);

  const overallProgress = useMemo(() => overallOf(items), [items]);

  return {
    items,
    phase,
    cancelled: cancelledState,
    overallProgress,
    elapsedMs,
    etaMs: estimateEta(elapsedMs, overallProgress),
    savedBytes: savedBytesOf(items),
    compressedCount: items.filter(item => item.phase === 'done').length,
    cancel,
  };
}

function pendingItem(video: LibraryVideo, action: BatchSaveAction): BatchItem {
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
function saveModeFor(
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
function overallOf(items: BatchItem[]): number {
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

function savedBytesOf(items: BatchItem[]): number {
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

/** `Asset.delete` resolves the same on Allow and Deny — existence afterwards is the only truth. */
async function originalSurvived(assetId: string): Promise<boolean> {
  try {
    return await assetExists(assetId);
  } catch (error) {
    console.warn('[batch] could not verify a replaced original', error);
    return true;
  }
}

function estimateEta(elapsedMs: number, progress: number): number | null {
  if (progress < MIN_PROGRESS_FOR_ETA || progress >= 1) return null;
  return Math.round((elapsedMs / progress) * (1 - progress));
}

function clampProgress(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Compression failed.';
}
