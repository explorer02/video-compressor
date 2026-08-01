import { useCallback, useState } from 'react';

import {
  assetExists,
  deleteAssets,
  type LibraryVideo,
} from '../../core/videoLibrary';

export type DeleteVideosOptions = {
  onDeleted: (message: string) => void;
  /** Nothing went — the OS dialog was dismissed. */
  onKept: (message: string) => void;
  onFailed: (message: string) => void;
};

export type DeleteVideos = {
  busy: boolean;
  remove: (videos: LibraryVideo[]) => void;
};

/**
 * Deletes videos from the device library, one or many.
 *
 * The platform shows its own confirmation dialog and resolves the same way whether the user
 * confirmed or dismissed it (§10), so the only way to report the truth is to look for the assets
 * afterwards — and with a batch, the honest answer can be "some of them".
 */
export function useDeleteVideos({
  onDeleted,
  onKept,
  onFailed,
}: DeleteVideosOptions): DeleteVideos {
  const [busy, setBusy] = useState(false);

  const remove = useCallback(
    (videos: LibraryVideo[]) => {
      if (busy || videos.length === 0) return;
      setBusy(true);

      void (async () => {
        try {
          await deleteAssets(videos.map(video => video.id));

          const survivors = await countSurvivors(videos);
          const deleted = videos.length - survivors;

          if (deleted === 0) onKept(keptMessage(videos));
          else onDeleted(deletedMessage(videos, deleted));
        } catch (error) {
          console.warn('[library] failed to delete videos', error);
          onFailed(
            videos.length === 1
              ? 'Could not delete that video.'
              : 'Could not delete those videos.'
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, onDeleted, onFailed, onKept]
  );

  return { busy, remove };
}

async function countSurvivors(videos: LibraryVideo[]): Promise<number> {
  const checks = await Promise.all(videos.map(video => assetExists(video.id)));
  return checks.filter(Boolean).length;
}

function keptMessage(videos: LibraryVideo[]): string {
  return videos.length === 1
    ? 'That video was left untouched.'
    : 'Those videos were left untouched.';
}

/** A partial delete is reported as such rather than rounded up to success. */
function deletedMessage(videos: LibraryVideo[], deleted: number): string {
  if (videos.length === 1) return `Deleted ${videos[0].filename}.`;
  if (deleted === videos.length) return `Deleted ${deleted} videos.`;
  return `Deleted ${deleted} of ${videos.length} videos.`;
}
