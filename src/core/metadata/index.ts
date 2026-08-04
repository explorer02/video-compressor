import { File } from 'expo-file-system';
import { getVideoMetaData } from 'react-native-compressor';

import {
  MediaTools,
  mediaToolsCapabilities,
  type AppliedMetadataReport,
  type NativeVideoProperties,
} from '../../../modules/media-tools';
import { ASSUMED_FRAME_RATE } from '../compression/tiers';
import type { SourceVideo } from '../compression/types';
import {
  resolveLocalPath,
  type LibraryVideo,
  type VideoAssetId,
} from '../videoLibrary';

/**
 * Everything the app knows about a source video, and everything it writes back onto a saved one
 * (§8). Native detail lives in `media-tools`; this module decides what to do when a platform
 * cannot supply a field.
 */

export type { AppliedMetadataReport };

export const canKeepOriginalMetadata =
  mediaToolsCapabilities.captureDateWriteBack;

/** Whether a keep-original save also carries GPS — iOS can, Android cannot (§8). UI copy keys on it. */
export const canCarryLocation = mediaToolsCapabilities.locationWriteBack;

/**
 * Reads the facts a compression needs: a real path, exact size, and the capture metadata that
 * "keep original metadata" will copy forward.
 *
 * `getVideoMetaData` returns only extension, size, duration, width and height — no frame rate,
 * rotation or GPS — so those come from the native module, and fall back to safe defaults on a
 * platform that cannot supply them.
 */
export async function readSourceVideo(
  video: LibraryVideo
): Promise<SourceVideo> {
  const path = await resolveLocalPath(video.id);
  const [probe, native] = await Promise.all([
    getVideoMetaData(path),
    readNativeProperties(video.id),
  ]);
  const file = new File(path);

  return {
    assetId: video.id,
    path,
    sizeBytes: firstPositive(
      native?.sizeBytes,
      file.exists ? file.size : null,
      probe.size
    ),
    width: firstPositive(probe.width, video.width),
    height: firstPositive(probe.height, video.height),
    // `getVideoMetaData` reports seconds; everything above this module works in milliseconds.
    durationMs: firstPositive(probe.duration * 1000, video.durationMs),
    frameRate: firstPositive(native?.frameRate) || ASSUMED_FRAME_RATE,
    rotationDegrees: native?.rotationDegrees ?? 0,
    capturedAt: native?.capturedAtMs ?? video.createdAt,
    modifiedAt: video.modifiedAt,
    folder: native?.folder ?? null,
    location: native?.location ?? null,
  };
}

/**
 * §8: copies the source's dates — and, where the platform supports it, its location — onto a newly
 * saved asset.
 *
 * Location is sent only when the platform can actually store it. Android cannot (the media store's
 * location columns were removed in Android 10), so asking would only produce a skip entry for
 * something the user was never promised.
 *
 * The report names every field that could not be carried over, which is the logging §8 asks for —
 * and the same channel through which a platform without an implementation reports itself.
 */
export async function applySavedAssetMetadata(
  savedAssetId: VideoAssetId,
  source: SourceVideo
): Promise<AppliedMetadataReport> {
  const report = await MediaTools.applyAssetMetadata(savedAssetId, {
    ...(source.capturedAt !== null ? { capturedAtMs: source.capturedAt } : {}),
    ...(source.modifiedAt !== null ? { modifiedAtMs: source.modifiedAt } : {}),
    ...(mediaToolsCapabilities.locationWriteBack && source.location
      ? source.location
      : {}),
  });

  logMetadataSkips(report);
  return report;
}

/** §8's logging duty: every field that could not be carried over is named, with the reason. */
export function logMetadataSkips(report: AppliedMetadataReport): void {
  for (const { field, reason } of report.skipped) {
    console.warn(`[metadata] ${field} was not carried over: ${reason}`);
  }
}

async function readNativeProperties(
  assetId: VideoAssetId
): Promise<NativeVideoProperties | null> {
  if (!mediaToolsCapabilities.videoProperties) return null;

  try {
    return await MediaTools.readVideoProperties(assetId);
  } catch (error) {
    console.warn('[metadata] native video properties unavailable', error);
    return null;
  }
}

function firstPositive(...candidates: (number | null | undefined)[]): number {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate > 0) return candidate;
  }
  return 0;
}
