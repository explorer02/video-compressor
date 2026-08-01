import { useCallback, useState } from 'react';

import {
  assetExists,
  deleteAssets,
  type LibraryVideo,
} from '../../core/videoLibrary';

export type DeleteVideoOptions = {
  onDeleted: (message: string) => void;
  /** The OS dialog was dismissed, so the video is still there. */
  onKept: (message: string) => void;
  onFailed: (message: string) => void;
};

export type DeleteVideo = {
  busy: boolean;
  remove: (video: LibraryVideo) => void;
};

/**
 * Deletes a video from the device library.
 *
 * The platform shows its own confirmation dialog and resolves the same way whether the user
 * confirmed or cancelled (§10), so the only way to report the truth is to look for the asset
 * afterwards — the same check "Replace original" relies on.
 */
export function useDeleteVideo({
  onDeleted,
  onKept,
  onFailed,
}: DeleteVideoOptions): DeleteVideo {
  const [busy, setBusy] = useState(false);

  const remove = useCallback(
    (video: LibraryVideo) => {
      if (busy) return;
      setBusy(true);

      void (async () => {
        try {
          await deleteAssets([video.id]);

          if (await assetExists(video.id)) {
            onKept('That video was left untouched.');
          } else {
            onDeleted(`Deleted ${video.filename}.`);
          }
        } catch (error) {
          console.warn('[library] failed to delete video', error);
          onFailed('Could not delete that video.');
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, onDeleted, onFailed, onKept]
  );

  return { busy, remove };
}
