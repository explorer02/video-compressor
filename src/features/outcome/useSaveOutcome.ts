import { useCallback, useState } from 'react';

import type { CompressionOutcome } from '../../core/compression/types';
import {
  applySavedAssetMetadata,
  type AppliedMetadataReport,
} from '../../core/metadata';
import {
  assetExists,
  deleteAssets,
  saveCarriesMetadata,
  saveToLibrary,
} from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';

/**
 * §3.4 — what happens to a finished compression.
 *
 * `fresh` saves a new gallery asset dated now with no location. `original` additionally copies the
 * source's capture date and GPS onto the saved asset, which needs the native module.
 */
export type SaveMode = 'fresh' | 'original';

export type SaveOutcomeOptions = {
  outcome: CompressionOutcome;
  onSaved: (message: string) => void;
  onDiscarded: () => void;
  onFailed: (message: string) => void;
};

export type SaveOutcome = {
  busy: boolean;
  saveCopy: (mode: SaveMode) => void;
  replaceOriginal: () => void;
  discard: () => void;
};

export function useSaveOutcome({
  outcome,
  onSaved,
  onDiscarded,
  onFailed,
}: SaveOutcomeOptions): SaveOutcome {
  const [busy, setBusy] = useState(false);

  const saveCopy = useCallback(
    (mode: SaveMode) => {
      if (busy) return;
      setBusy(true);

      void (async () => {
        try {
          const report = await saveWithMetadata(outcome, mode);

          // The gallery has its own copy now; ours is just a temp file.
          workspace.discard(outcome.outputPath);
          onSaved(savedMessage(mode, report));
        } catch (error) {
          console.warn('[outcome] failed to save copy', error);
          onFailed('Could not save the compressed video.');
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, onFailed, onSaved, outcome]
  );

  /**
   * §3.4 — save the copy with the original metadata, then delete the source.
   *
   * The OS shows its own confirmation dialog for the delete and cannot be bypassed. `Asset.delete`
   * resolves to void whether the user confirmed or cancelled, so the only way to know which
   * happened is to look for the asset afterwards (§10).
   */
  const replaceOriginal = useCallback(() => {
    if (busy) return;
    setBusy(true);

    void (async () => {
      try {
        await saveWithMetadata(outcome, 'original');
        workspace.discard(outcome.outputPath);

        await deleteAssets([outcome.source.assetId]);
        const originalSurvived = await assetExists(outcome.source.assetId);

        onSaved(
          originalSurvived
            ? 'Saved the compressed copy. The original was left untouched.'
            : 'Replaced the original with the compressed version.'
        );
      } catch (error) {
        console.warn('[outcome] failed to replace original', error);
        onFailed('Could not replace the original video.');
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, onFailed, onSaved, outcome]);

  const discard = useCallback(() => {
    workspace.discard(outcome.outputPath);
    onDiscarded();
  }, [onDiscarded, outcome.outputPath]);

  return { busy, saveCopy, replaceOriginal, discard };
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
  const keepOriginal = mode === 'original';

  const savedAssetId = await saveToLibrary(outputPath, {
    filename: filenameOf(outputPath),
    // Even a fresh-metadata copy belongs beside the original rather than in the camera folder.
    ...(source.folder ? { folder: source.folder } : {}),
    ...(keepOriginal && source.capturedAt !== null
      ? { capturedAtMs: source.capturedAt }
      : {}),
    ...(keepOriginal && source.modifiedAt !== null
      ? { modifiedAtMs: source.modifiedAt }
      : {}),
  });

  if (!keepOriginal) return null;
  if (saveCarriesMetadata) {
    return { applied: ['capturedAt', 'modifiedAt'], skipped: [] };
  }
  return applySavedAssetMetadata(savedAssetId, source);
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
function savedMessage(
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
