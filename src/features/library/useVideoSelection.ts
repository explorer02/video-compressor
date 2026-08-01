import { useCallback, useMemo, useState } from 'react';

import type { LibraryVideo, VideoAssetId } from '../../core/videoLibrary';

export type VideoSelection = {
  /** True once the browser is in selection mode, even with nothing selected yet. */
  active: boolean;
  count: number;
  isSelected: (video: LibraryVideo) => boolean;
  /** Enters selection mode with this video selected. */
  begin: (video: LibraryVideo) => void;
  toggle: (video: LibraryVideo) => void;
  selectAll: (videos: LibraryVideo[]) => void;
  clear: () => void;
};

/**
 * Which videos the user has picked out for a bulk action.
 *
 * Selection mode is a separate flag from "something is selected", so deselecting the last row
 * leaves the user in the mode they chose rather than silently dropping them out of it.
 */
export function useVideoSelection(): VideoSelection {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<VideoAssetId>>(new Set());

  const begin = useCallback((video: LibraryVideo) => {
    setActive(true);
    setIds(new Set([video.id]));
  }, []);

  const toggle = useCallback((video: LibraryVideo) => {
    setIds(current => {
      const next = new Set(current);
      if (!next.delete(video.id)) next.add(video.id);
      return next;
    });
  }, []);

  const selectAll = useCallback((videos: LibraryVideo[]) => {
    setActive(true);
    setIds(new Set(videos.map(video => video.id)));
  }, []);

  const clear = useCallback(() => {
    setActive(false);
    setIds(new Set());
  }, []);

  const isSelected = useCallback(
    (video: LibraryVideo) => ids.has(video.id),
    [ids]
  );

  return useMemo(
    () => ({
      active,
      count: ids.size,
      isSelected,
      begin,
      toggle,
      selectAll,
      clear,
    }),
    [active, begin, clear, ids.size, isSelected, selectAll, toggle]
  );
}
