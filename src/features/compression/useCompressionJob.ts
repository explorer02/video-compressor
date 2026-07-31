import { useCallback, useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';

import { compressToTier } from '../../core/compression/reactNativeCompressor';
import { estimateOutputBytes, tierById } from '../../core/compression/tiers';
import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
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
        onCompleted(outcome);
      } catch (error) {
        if (!active) return;

        workspace.markJobFinished();
        if (cancelled.current) onCancelled();
        else setJob({ phase: 'failed', message: describe(error) });
      } finally {
        clearInterval(ticker);
      }
    })();

    return () => {
      active = false;
      clearInterval(ticker);
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
