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
 * Progress crosses the bridge on every native event (§3.3 shows tenth-of-a-percent steps, so 2%
 * blocks read as stalling). The encoder reports per chunk, not per frame, so the resulting event
 * rate is well within what the JS thread absorbs without jank.
 *
 * These events are also what moves the background notification (§7) — nothing else runs while the
 * app is off screen.
 */
const PROGRESS_DIVIDER = 0;

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
