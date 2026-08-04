import { useCallback, useMemo, useState } from 'react';

import type { BatchSaveAction } from '../../../app/flow/types';
import type { LibraryVideo, VideoAssetId } from '../../../core/videoLibrary';

export type BatchActions = {
  /** The action for a video; `copy` until the user says otherwise. */
  actionFor: (video: LibraryVideo) => BatchSaveAction;
  setAction: (video: LibraryVideo, action: BatchSaveAction) => void;
  setAllActions: (action: BatchSaveAction) => void;
};

/** The per-video Copy/Replace choices, defaulting to the safe one. */
export function useBatchActions(videos: LibraryVideo[]): BatchActions {
  const [actions, setActions] = useState<
    ReadonlyMap<VideoAssetId, BatchSaveAction>
  >(() => new Map());

  const actionFor = useCallback(
    (video: LibraryVideo): BatchSaveAction => actions.get(video.id) ?? 'copy',
    [actions]
  );

  const setAction = useCallback(
    (video: LibraryVideo, action: BatchSaveAction) =>
      setActions(current => new Map(current).set(video.id, action)),
    []
  );

  const setAllActions = useCallback(
    (action: BatchSaveAction) =>
      setActions(new Map(videos.map(video => [video.id, action]))),
    [videos]
  );

  // A stable object, so `renderItem`/header memos keyed on it survive unrelated re-renders.
  return useMemo(
    () => ({ actionFor, setAction, setAllActions }),
    [actionFor, setAction, setAllActions]
  );
}
