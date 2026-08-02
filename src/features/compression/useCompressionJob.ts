import { useCallback, useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';

import {
  beginBackgroundSession,
  ensureNotificationPermission,
} from '../../core/background';
import { compressToTier } from '../../core/compression/reactNativeCompressor';
import {
  estimateOutputBytes,
  tierById,
  type QualityTier,
} from '../../core/compression/tiers';
import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import { formatDurationWords } from '../../core/format';
import type { LibraryVideo } from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';

/** Elapsed time ticks often enough to feel live without re-rendering the whole screen constantly. */
const TICK_MS = 500;

/** Below this the remaining-time guess swings wildly; §3.3 only promises a rough ETA. */
const MIN_PROGRESS_FOR_ETA = 0.05;

export type CompressionJob =
  | {
      phase: 'running';
      progress: number;
      elapsedMs: number;
      etaMs: number | null;
    }
  | { phase: 'failed'; message: string };

export type CompressionJobOptions = {
  video: LibraryVideo;
  source: SourceVideo;
  tierId: QualityTierId;
  onCompleted: (outcome: CompressionOutcome) => void;
  onCancelled: () => void;
};

export function useCompressionJob({
  video,
  source,
  tierId,
  onCompleted,
  onCancelled,
}: CompressionJobOptions): { job: CompressionJob; cancel: () => void } {
  useKeepAwake();

  const [job, setJob] = useState<CompressionJob>({
    phase: 'running',
    progress: 0,
    elapsedMs: 0,
    etaMs: null,
  });

  const cancelRun = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);

  const cancel = useCallback(() => {
    cancelled.current = true;
    cancelRun.current?.();
  }, []);

  useEffect(() => {
    const tier = tierById(tierId);
    const startedAt = Date.now();
    let active = true;
    let progress = 0;

    if (!workspace.hasRoomFor(estimateOutputBytes(tier, source))) {
      // Reported through the same async path as any other failure so the effect body stays clean.
      queueMicrotask(() => {
        if (active) setJob({ phase: 'failed', message: NOT_ENOUGH_SPACE });
      });
      return () => {
        active = false;
      };
    }

    workspace.markJobStarted({ assetId: source.assetId, tierId, startedAt });

    // §7: the job survives backgrounding, and the notification reflects the same progress the
    // screen shows. Tapping it reopens the app, still in the Compressing state.
    //
    // The permission prompt is not awaited: encoding starts immediately either way, and the next
    // progress tick posts the notification once the user has answered.
    void ensureNotificationPermission();
    const background = beginBackgroundSession(`Compressing ${video.filename}`);

    // The screen's own clock. It stops while the app is backgrounded — Android suspends JS timers
    // with the activity — which is why it does not drive the notification.
    const ticker = setInterval(() => {
      if (!active) return;
      const elapsedMs = Date.now() - startedAt;
      setJob({
        phase: 'running',
        progress,
        elapsedMs,
        etaMs: estimateEta(elapsedMs, progress),
      });
    }, TICK_MS);

    const run = compressToTier(source, tier, fraction => {
      progress = clampProgress(fraction);
      // Encoder events keep arriving in the background, so the notification is posted from here
      // rather than from the ticker above — otherwise it freezes the moment the app leaves screen.
      // Built inline: this callback outlives hot reloads inside the native module, so it must not
      // lean on helpers a swapped-out module instance may no longer hold.
      const elapsedMs = Date.now() - startedAt;
      const etaMs = estimateEta(elapsedMs, progress);
      background.update(progress, {
        elapsed: `${formatDurationWords(elapsedMs)} elapsed`,
        remaining:
          etaMs === null ? 'Estimating…' : `${formatDurationWords(etaMs)} left`,
      });
    });
    cancelRun.current = run.cancel;
    // True once the run reached an outcome (completed, failed, or user-cancelled).
    let settled = false;

    void (async () => {
      try {
        const producedPath = await run.output;
        if (!active) return;

        const outcome = await adoptOutput(
          video,
          source,
          tierId,
          producedPath,
          startedAt
        );
        if (!active) return;

        settled = true;
        workspace.markJobFinished();
        logEstimateAccuracy(tier, source, outcome.outputSizeBytes);
        logEncodeSpeed(tier, source, outcome.elapsedMs);
        onCompleted(outcome);
      } catch (error) {
        if (!active) return;

        settled = true;
        workspace.markJobFinished();
        if (cancelled.current) onCancelled();
        else setJob({ phase: 'failed', message: describe(error) });
      } finally {
        clearInterval(ticker);
        background.end();
      }
    })();

    return () => {
      active = false;
      clearInterval(ticker);
      background.end();
      // Unmounting mid-run (back navigation, a permission flip re-rendering the router) must not
      // leave the native encoder running headless — cancel it and close the job journal so the
      // next launch does not report a compression that was deliberately walked away from.
      if (!settled) {
        run.cancel();
        workspace.markJobFinished();
      }
    };
  }, [onCancelled, onCompleted, source, tierId, video]);

  return { job, cancel };
}

const NOT_ENOUGH_SPACE =
  'Not enough free space on this device to compress this video.';

/**
 * Takes ownership of the encoder's output and checks §5's hard rule: never produce a file larger
 * than the source. A bigger output is discarded rather than offered.
 */
async function adoptOutput(
  video: LibraryVideo,
  source: SourceVideo,
  tierId: QualityTierId,
  producedPath: string,
  startedAt: number
): Promise<CompressionOutcome> {
  // The encoder can hand back the input untouched when it decides there is nothing to do. Adopting
  // that would move the user's original into our temp directory and then delete it as "not
  // smaller" — so the source path is the one thing we must never take ownership of.
  if (isSamePath(producedPath, source.path)) {
    throw new Error(
      'This video is already optimized — compressing it would not make it smaller.'
    );
  }

  const adopted = workspace.adopt(producedPath, outputFilename(video, tierId));
  const outputSizeBytes = new File(adopted.uri).size;

  if (outputSizeBytes >= source.sizeBytes) {
    workspace.discard(adopted.uri);
    throw new Error(
      'This video is already optimized — compressing it would not make it smaller.'
    );
  }

  return {
    video,
    tier: tierId,
    source,
    outputPath: adopted.uri,
    outputSizeBytes,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Same file, allowing for the `file://` prefix appearing on one side and not the other. */
function isSamePath(a: string, b: string): boolean {
  const bare = (path: string) => decodeURI(path).replace(/^file:\/\//, '');
  return bare(a) === bare(b);
}

function outputFilename(video: LibraryVideo, tierId: QualityTierId): string {
  const stem = video.filename.replace(/\.[^.]+$/, '') || 'video';
  return `${stem}-${tierId}.mp4`;
}

/** §6: the estimate is only as good as the feedback loop, so record how close each one landed. */
function logEstimateAccuracy(
  tier: QualityTier,
  source: SourceVideo,
  actualBytes: number
): void {
  const estimated = estimateOutputBytes(tier, source);
  if (estimated === null || actualBytes <= 0) return;

  const driftPercent = Math.round((actualBytes / estimated - 1) * 100);
  console.log(
    `[estimate] tier=${tier.id} fps=${source.frameRate} estimated=${estimated}B ` +
      `actual=${actualBytes}B drift=${driftPercent > 0 ? '+' : ''}${driftPercent}%`
  );
}

/**
 * §7 asks for ≥ 2× real-time. Encoding cost is set by pixels × frames, so logging the ratio
 * alongside both makes a slow run diagnosable instead of anecdotal.
 */
function logEncodeSpeed(
  tier: QualityTier,
  source: SourceVideo,
  elapsedMs: number
): void {
  if (elapsedMs <= 0 || source.durationMs <= 0) return;

  const realtimeRatio = source.durationMs / elapsedMs;
  console.log(
    `[speed] tier=${tier.id} ${source.width}x${source.height}@${Math.round(source.frameRate)}fps ` +
      `duration=${Math.round(source.durationMs / 1000)}s elapsed=${Math.round(elapsedMs / 1000)}s ` +
      `ratio=${realtimeRatio.toFixed(2)}x realtime (target >= 2x)`
  );
}

function estimateEta(elapsedMs: number, progress: number): number | null {
  if (progress < MIN_PROGRESS_FOR_ETA) return null;
  return Math.round((elapsedMs / progress) * (1 - progress));
}

function clampProgress(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Compression failed.';
}
