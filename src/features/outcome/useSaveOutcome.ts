import { useCallback, useState } from 'react';

import type { CompressionOutcome } from '../../core/compression/types';
import {
  applySavedAssetMetadata,
  type AppliedMetadataReport,
} from '../../core/metadata';
import { saveToLibrary } from '../../core/videoLibrary';
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
          const savedAssetId = await saveToLibrary(outcome.outputPath);
          const report =
            mode === 'original'
              ? await applySavedAssetMetadata(savedAssetId, outcome.source)
              : null;

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
    [busy, onFailed, onSaved, outcome.outputPath]
  );

  const discard = useCallback(() => {
    workspace.discard(outcome.outputPath);
    onDiscarded();
  }, [onDiscarded, outcome.outputPath]);

  return { busy, saveCopy, discard };
}

/** §8 requires that fields which could not be carried over are surfaced, not silently dropped. */
function savedMessage(
  mode: SaveMode,
  report: AppliedMetadataReport | null
): string {
  if (mode === 'fresh') return 'Saved to your gallery.';
  if (!report || report.applied.length === 0) {
    return 'Saved to your gallery, but the original date could not be kept.';
  }
  return report.skipped.length > 0
    ? 'Saved with the original date. Location could not be carried over.'
    : 'Saved with the original date and location.';
}
