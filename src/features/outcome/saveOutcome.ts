import type { CompressionOutcome } from '../../core/compression/types';
import {
  applySavedAssetMetadata,
  type AppliedMetadataReport,
} from '../../core/metadata';
import {
  saveCarriesMetadata,
  saveToLibrary,
  type SaveTarget,
} from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';

/**
 * Saving a finished compression into the gallery — callable from the single-video preview and from
 * the batch queue alike.
 *
 * `fresh` saves a new gallery asset dated now with no location. `original` additionally copies the
 * source's capture date and GPS onto the saved asset, which needs the native module.
 */
export type SaveMode = 'fresh' | 'original';

/**
 * Saves the output as a new gallery asset and releases the temp file. Once this resolves, the
 * gallery owns the video — the workspace copy is gone either way.
 */
export async function saveCompressedCopy(
  outcome: CompressionOutcome,
  mode: SaveMode
): Promise<AppliedMetadataReport | null> {
  const report = await saveWithMetadata(outcome, mode);
  workspace.discard(outcome.outputPath);
  return report;
}

/**
 * Saves the encode, carrying the source's folder and dates when asked for.
 *
 * Where the platform sets metadata as the asset is created, that is the whole job and nothing can
 * be partially applied. Where it does not, the asset is created first and the dates written
 * afterwards — the path that can fail per field, which is what the report describes.
 */
async function saveWithMetadata(
  outcome: CompressionOutcome,
  mode: SaveMode
): Promise<AppliedMetadataReport | null> {
  const { source, outputPath } = outcome;
  const target = saveTargetFor(outcome, mode);

  const savedAssetId = await saveToLibrary(outputPath, target);
  // One line per save; the native side logs the detail (`adb logcat -s MediaTools`).
  console.log(`[save] mode=${mode} → ${savedAssetId}`);

  if (mode !== 'original') return null;
  if (saveCarriesMetadata) {
    return { applied: ['capturedAt', 'modifiedAt'], skipped: [] };
  }
  return applySavedAssetMetadata(savedAssetId, source);
}

/** Only an "original" save carries the source's dates — a fresh copy is deliberately dated now. */
function saveTargetFor(
  { source, outputPath }: CompressionOutcome,
  mode: SaveMode
): SaveTarget {
  const keepOriginal = mode === 'original';

  return {
    filename: filenameOf(outputPath),
    // Even a fresh-metadata copy belongs beside the original rather than in the camera folder.
    ...(source.folder ? { folder: source.folder } : {}),
    ...(keepOriginal && source.capturedAt !== null
      ? { capturedAtMs: source.capturedAt }
      : {}),
    ...(keepOriginal && source.modifiedAt !== null
      ? { modifiedAtMs: source.modifiedAt }
      : {}),
  };
}

function filenameOf(path: string): string {
  return decodeURI(path).split('/').pop() || 'video.mp4';
}

/**
 * §8 requires that fields which could not be carried over are surfaced, not silently dropped.
 *
 * The claim is built from what was actually applied rather than from an empty skip list: a field
 * the source never had produces neither an applied nor a skipped entry, so an absent skip is not
 * evidence that anything was carried over.
 */
export function savedMessage(
  mode: SaveMode,
  report: AppliedMetadataReport | null
): string {
  if (mode === 'fresh') return 'Saved to your gallery.';

  const applied = new Set(report?.applied ?? []);
  if (applied.has('capturedAt') && applied.has('modifiedAt')) {
    return 'Saved with the original dates.';
  }
  if (applied.has('capturedAt')) return 'Saved with the original capture date.';
  return 'Saved to your gallery, but the original dates could not be kept.';
}
