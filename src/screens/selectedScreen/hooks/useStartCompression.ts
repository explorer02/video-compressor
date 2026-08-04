import { useState } from 'react';

import type {
  QualityTierId,
  SourceVideo,
} from '../../../core/compression/types';
import { readSourceVideo } from '../../../core/metadata';
import type { LibraryVideo } from '../../../core/videoLibrary';
import { useToast } from '../../../ui';
import { isGone } from '../utils';

export type StartCompression = {
  start: () => void;
  /** True while the source is being resolved — on iOS possibly an iCloud download. */
  resolving: boolean;
};

/**
 * The way from "Compress" tap to the compressing screen. Resolving a real path is the expensive
 * call, so it happens once, here, on the way to encoding.
 */
export function useStartCompression({
  video,
  tier,
  onStart,
  onBack,
}: {
  video: LibraryVideo;
  tier: QualityTierId | null;
  onStart: (source: SourceVideo, tier: QualityTierId) => void;
  onBack: () => void;
}): StartCompression {
  const toast = useToast();
  const [resolving, setResolving] = useState(false);

  const start = () => {
    if (!tier || resolving) return;
    setResolving(true);

    void (async () => {
      try {
        onStart(await readSourceVideo(video), tier);
      } catch (error) {
        console.warn('[selected] failed to read source video', error);

        // A vanished asset and a failed load are different stories: the first has nothing left to
        // retry (§10 stale entries — back out), the second — an iCloud download without a
        // connection, a transient read error — deserves another tap from right here.
        if (await isGone(video)) {
          toast.show('That video is no longer available.', 'danger');
          onBack();
        } else {
          toast.show(
            'Could not load this video. If it is stored in iCloud, check your connection and try again.',
            'danger'
          );
        }
      } finally {
        setResolving(false);
      }
    })();
  };

  return { start, resolving };
}
