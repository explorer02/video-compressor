import { useCallback, useEffect, useState } from 'react';

import { sizeIndex } from '../../core/sizeIndex';
import type { LibraryVideo } from '../../core/videoLibrary';

export type VideoSizes = {
  /** Bytes, or null while the size is still unknown or unsupported on this platform. */
  sizeOf: (video: LibraryVideo) => number | null;
  indexing: boolean;
  available: boolean;
  /** Total bytes of everything indexed so far, or null while the index is still filling. */
  totalBytes: number | null;
};

/** Keeps the size index filled for the rows currently loaded, and re-renders as sizes arrive. */
export function useVideoSizes(videos: LibraryVideo[]): VideoSizes {
  const [revision, setRevision] = useState(0);

  useEffect(
    () => sizeIndex.subscribe(() => setRevision(value => value + 1)),
    []
  );

  useEffect(() => {
    void sizeIndex.ensure(videos);
  }, [videos]);

  const sizeOf = useCallback(
    (video: LibraryVideo) => sizeIndex.get(video),
    // `revision` is the dependency that matters: the index is external mutable state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision]
  );

  const indexing = sizeIndex.pendingCount() > 0;

  return {
    sizeOf,
    indexing,
    available: sizeIndex.available,
    totalBytes:
      indexing || !sizeIndex.available ? null : sizeIndex.knownTotalBytes(),
  };
}
