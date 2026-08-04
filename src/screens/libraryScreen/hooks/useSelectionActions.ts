import { useCallback } from 'react';

import type { LibraryVideo } from '../../../core/videoLibrary';
import { useToastedDeletion } from '../../../features/library/useToastedDeletion';
import type { VideoSelection } from '../../../features/library/useVideoSelection';

export type SelectionActions = {
  compressSelection: () => void;
  deleteSelection: () => void;
  /** True while a delete is in flight — the bar's destructive button shows it. */
  deleting: boolean;
};

/** The SelectionBar's verbs: hand the selection to the batch flow, or delete it. */
export function useSelectionActions({
  selection,
  onCompressMany,
}: {
  selection: VideoSelection;
  onCompressMany: (videos: LibraryVideo[]) => void;
}): SelectionActions {
  const deletion = useToastedDeletion({
    onDeleted: selection.exit,
    onKept: selection.exit,
  });

  // Exit before handing off, so returning from the batch flow lands on a clean library.
  const compressSelection = useCallback(() => {
    const videos = selection.videos;
    selection.exit();
    onCompressMany(videos);
  }, [onCompressMany, selection]);

  const deleteSelection = useCallback(
    () => deletion.remove(selection.videos),
    [deletion, selection]
  );

  return { compressSelection, deleteSelection, deleting: deletion.busy };
}
