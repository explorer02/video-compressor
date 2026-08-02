import { Video } from 'react-native-compressor';

import { effectiveVideoKbps, outputLongEdge, type QualityTier } from './tiers';
import type { SourceVideo } from './types';

/**
 * The only module that talks to react-native-compressor.
 *
 * Both tiers run through the library's native hardware path (MediaCodec / VideoToolbox) — §7 rules
 * out any software encoder, and this library exposes no codec knobs anyway.
 */

export type CompressionRun = {
  /** Resolves with the path the encoder wrote, or rejects if it failed or was cancelled. */
  output: Promise<string>;
  cancel: () => void;
};

/**
 * Progress crosses the bridge every 2% instead of continuously, keeping the JS thread quiet.
 *
 * These events are also what moves the background notification (§7) — nothing else runs while the
 * app is off screen — so they have to be frequent enough to read as live, and 50 per job is not a
 * load worth economising on.
 */
const PROGRESS_DIVIDER = 2;

export function compressToTier(
  source: SourceVideo,
  tier: QualityTier,
  onProgress: (fraction: number) => void
): CompressionRun {
  let cancellationId: string | null = null;
  let cancelled = false;

  const output = Video.compress(
    source.path,
    {
      compressionMethod: tier.method,
      // Always explicit: the library silently defaults maxSize to 640.
      maxSize: outputLongEdge(tier, source),
      ...(tier.method === 'manual'
        ? { bitrate: effectiveVideoKbps(tier, source.frameRate) * 1000 }
        : {}),
      progressDivider: PROGRESS_DIVIDER,
      getCancellationId: id => {
        cancellationId = id;
        // Cancel can be pressed before the native side hands back an id.
        if (cancelled) Video.cancelCompression(id);
      },
    },
    onProgress
  );

  return {
    output,
    cancel: () => {
      cancelled = true;
      if (cancellationId) Video.cancelCompression(cancellationId);
    },
  };
}
