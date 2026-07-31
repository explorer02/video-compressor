import { File } from 'expo-file-system';
import { getVideoMetaData } from 'react-native-compressor';

import { ASSUMED_FRAME_RATE } from '../compression/tiers';
import type { SourceVideo } from '../compression/types';
import { resolveLocalPath, type LibraryVideo } from '../videoLibrary';

/**
 * Everything the app knows about a source video, and everything it writes back onto a saved one
 * (§8). This is the module the native `media-tools` implementation plugs into.
 */

/** Which metadata fields survived the round trip — §8 requires the ones that did not be logged. */
export type AppliedMetadataReport = {
  applied: MetadataField[];
  skipped: { field: MetadataField; reason: string }[];
};

export type MetadataField = 'capturedAt' | 'location';

/**
 * Reads the source facts a compression needs: a real path, exact size, and the capture metadata
 * that "keep original metadata" will copy forward.
 *
 * Frame rate, rotation and GPS need a platform API that no current dependency exposes —
 * `getVideoMetaData` returns only extension, size, duration, width and height — so they fall back
 * to safe defaults until the native module lands.
 */
export async function readSourceVideo(
  video: LibraryVideo
): Promise<SourceVideo> {
  const path = await resolveLocalPath(video.id);
  const probe = await getVideoMetaData(path);
  const file = new File(path);

  return {
    assetId: video.id,
    path,
    sizeBytes: file.exists && file.size > 0 ? file.size : probe.size,
    width: probe.width || video.width || 0,
    height: probe.height || video.height || 0,
    // `getVideoMetaData` reports seconds; everything above this module works in milliseconds.
    durationMs:
      probe.duration > 0 ? probe.duration * 1000 : (video.durationMs ?? 0),
    frameRate: ASSUMED_FRAME_RATE,
    rotationDegrees: 0,
    capturedAt: video.createdAt,
    location: null,
  };
}
