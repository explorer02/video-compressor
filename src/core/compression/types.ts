import type { LibraryVideo, VideoAssetId } from '../videoLibrary/types';

export type QualityTierId = 'whatsApp' | 'hd' | 'fullHd';

/** Everything the compressor and the estimator need to know about a source video. */
export type SourceVideo = {
  assetId: VideoAssetId;
  /** Local filesystem path the compressor can read. */
  path: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationMs: number;
  frameRate: number;
  /** Degrees; 90/270 mean the display orientation is swapped relative to width/height. */
  rotationDegrees: number;
  /** Epoch milliseconds of original capture, when the platform records it. */
  capturedAt: number | null;
  /** Epoch milliseconds the source was last modified. */
  modifiedAt: number | null;
  /** The folder the source lives in, so a copy can be saved beside it. Null where unknown. */
  folder: string | null;
  location: { latitude: number; longitude: number } | null;
};

export type CompressionOutcome = {
  video: LibraryVideo;
  tier: QualityTierId;
  source: SourceVideo;
  outputPath: string;
  outputSizeBytes: number;
  elapsedMs: number;
};
