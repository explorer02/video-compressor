import { useCallback, useMemo, useState } from 'react';

import type { LibraryVideo, VideoAssetId } from '../../core/videoLibrary';

export type VideoSelection = {
  /** True once the browser is in selection mode, even with nothing selected yet. */
  active: boolean;
  count: number;
  /** The selected videos themselves — the selection can reach beyond the pages on screen. */
  videos: LibraryVideo[];
  isSelected: (video: LibraryVideo) => boolean;
  /** Enters selection mode with this video selected. */
  begin: (video: LibraryVideo) => void;
  toggle: (video: LibraryVideo) => void;
  selectAll: (videos: LibraryVideo[]) => void;
  /** Empties the selection but stays in selection mode. */
  selectNone: () => void;
  /** Leaves selection mode entirely. */
  exit: () => void;
};

const NO_PICKS: ReadonlyMap<VideoAssetId, LibraryVideo> = new Map();

/**
 * Which videos the user has picked out for a bulk action.
 *
 * Selection mode is a separate flag from "something is selected", so deselecting the last row
 * leaves the user in the mode they chose rather than silently dropping them out of it.
 *
 * The selection stores whole videos, not just ids: "Select all" covers the entire view, including
 * videos whose rows were never loaded, and the bulk action needs the assets, not a lookup into
 * whatever happens to be paged in.
 */
export function useVideoSelection(): VideoSelection {
  const [active, setActive] = useState(false);
  const [picked, setPicked] =
    useState<ReadonlyMap<VideoAssetId, LibraryVideo>>(NO_PICKS);

  const begin = useCallback((video: LibraryVideo) => {
    setActive(true);
    setPicked(new Map([[video.id, video]]));
  }, []);

  const toggle = useCallback((video: LibraryVideo) => {
    setPicked(current => {
      const next = new Map(current);
      if (!next.delete(video.id)) next.set(video.id, video);
      return next;
    });
  }, []);

  const selectAll = useCallback((videos: LibraryVideo[]) => {
    setActive(true);
    setPicked(new Map(videos.map(video => [video.id, video])));
  }, []);

  const selectNone = useCallback(() => setPicked(NO_PICKS), []);

  const exit = useCallback(() => {
    setActive(false);
    setPicked(NO_PICKS);
  }, []);

  const isSelected = useCallback(
    (video: LibraryVideo) => picked.has(video.id),
    [picked]
  );

  const videos = useMemo(() => [...picked.values()], [picked]);

  return useMemo(
    () => ({
      active,
      count: picked.size,
      videos,
      isSelected,
      begin,
      toggle,
      selectAll,
      selectNone,
      exit,
    }),
    [
      active,
      begin,
      exit,
      isSelected,
      picked.size,
      selectAll,
      selectNone,
      toggle,
      videos,
    ]
  );
}
