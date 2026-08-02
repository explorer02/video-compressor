import { useCallback, useState } from 'react';

import type { CompressionOutcome } from '../../core/compression/types';
import { assetExists, deleteAssets } from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';
import { saveCompressedCopy, savedMessage, type SaveMode } from './saveOutcome';

/** §3.4 — what happens to a finished compression. */

export type { SaveMode };

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
          const report = await saveCompressedCopy(outcome, mode);
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
        await saveCompressedCopy(outcome, 'original');

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
