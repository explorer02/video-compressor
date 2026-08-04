import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

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
 * Deletes videos from the device library, one or many — confirmation included, so callers just
 * call `remove` and exactly one question reaches the user.
 *
 * The platform's own delete dialog (Android 11+, iOS) cannot be bypassed and resolves the same
 * way whether the user confirmed or dismissed it (§10), so the only way to report the truth is to
 * look for the assets afterwards — and with a batch, the honest answer can be "some of them".
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

      confirmIntent(videos, () => {
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
      });
    },
    [busy, onDeleted, onFailed, onKept]
  );

  // Stable while nothing changed, so callbacks built on this survive unrelated re-renders and
  // memoized consumers (the library's SelectionBar) can actually skip work.
  return useMemo(() => ({ busy, remove }), [busy, remove]);
}

/**
 * Android 11+ and iOS put a mandatory system dialog in front of every media delete, so an in-app
 * warning there would make the user confirm the same delete twice. Only older Android deletes
 * silently — there the app's own warning is the only thing standing before the files go.
 */
const SYSTEM_CONFIRMS_DELETES =
  Platform.OS === 'ios' ||
  (Platform.OS === 'android' && Number(Platform.Version) >= 30);

function confirmIntent(videos: LibraryVideo[], onConfirmed: () => void): void {
  if (SYSTEM_CONFIRMS_DELETES) {
    onConfirmed();
    return;
  }

  Alert.alert(
    videos.length === 1
      ? 'Delete this video?'
      : `Delete ${videos.length} videos?`,
    videos.length === 1
      ? `${videos[0].filename} will be removed from your device. This can’t be undone.`
      : 'They will be removed from your device. This can’t be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirmed },
    ]
  );
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
