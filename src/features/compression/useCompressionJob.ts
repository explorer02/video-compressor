import { useCallback, useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';

import { beginBackgroundSession } from '../../core/background';
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
    const background = beginBackgroundSession(`Compressing ${video.filename}`);

    const ticker = setInterval(() => {
      if (!active) return;
      const elapsedMs = Date.now() - startedAt;
      const etaMs = estimateEta(elapsedMs, progress);
      setJob({ phase: 'running', progress, elapsedMs, etaMs });
      background.update(progress, remainingLabel(etaMs));
    }, TICK_MS);

    const run = compressToTier(source, tier, fraction => {
      progress = clampProgress(fraction);
    });
    cancelRun.current = run.cancel;

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

        workspace.markJobFinished();
        logEstimateAccuracy(tier, source, outcome.outputSizeBytes);
        onCompleted(outcome);
      } catch (error) {
        if (!active) return;

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

function remainingLabel(etaMs: number | null): string {
  return etaMs === null
    ? 'Estimating time remaining…'
    : `About ${formatDurationWords(etaMs)} left`;
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
