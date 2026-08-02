import { File } from 'expo-file-system';

import type { LibraryVideo } from '../videoLibrary';
import { workspace } from '../workspace';
import { compressToTier } from './reactNativeCompressor';
import { estimateOutputBytes, tierById, type QualityTier } from './tiers';
import type { CompressionOutcome, QualityTierId, SourceVideo } from './types';

/**
 * One compression, start to adopted output — the piece shared by the single-video screen and the
 * batch queue. Callers own everything around it: journals, notifications, tickers, and what
 * happens to the outcome.
 */

export type CompressionJobRun = {
  /** Resolves once the output is adopted and verified smaller; rejects on failure or cancel. */
  outcome: Promise<CompressionOutcome>;
  cancel: () => void;
};

export function runCompressionJob(
  video: LibraryVideo,
  source: SourceVideo,
  tierId: QualityTierId,
  onProgress: (fraction: number) => void
): CompressionJobRun {
  const tier = tierById(tierId);
  const startedAt = Date.now();
  const run = compressToTier(source, tier, onProgress);

  const outcome = run.output.then(async producedPath => {
    const adopted = await adoptOutput(
      video,
      source,
      tierId,
      producedPath,
      startedAt
    );
    logEstimateAccuracy(tier, source, adopted.outputSizeBytes);
    logEncodeSpeed(tier, source, adopted.elapsedMs);
    return adopted;
  });

  return { outcome, cancel: run.cancel };
}

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
