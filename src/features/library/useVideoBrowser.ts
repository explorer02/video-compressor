import { useCallback, useEffect, useRef, useState } from 'react';

import { sizeIndex } from '../../core/sizeIndex';
import {
  DEFAULT_SORT,
  listAllVideoIds,
  listAllVideos,
  listVideos,
  nextSort,
  readStoredSort,
  storeSort,
  subscribeToLibraryChanges,
  type LibraryVideo,
  type MediaStoreSortKey,
  type VideoSort,
  type VideoSortKey,
} from '../../core/videoLibrary';

/** §4: ~60 rows per page, infinite scroll. */
const PAGE_SIZE = 60;

/** The media library emits a burst of events after a save or delete — collapse them. */
const CHANGE_DEBOUNCE_MS = 400;

const NO_VIDEOS: LibraryVideo[] = [];

export type BrowserStatus = 'loading' | 'ready' | 'error';

export type VideoBrowser = {
  videos: LibraryVideo[];
  status: BrowserStatus;
  refreshing: boolean;
  hasMore: boolean;
  /** Null until the background count pass finishes. */
  totalCount: number | null;
  sort: VideoSort;
  /** False until the size index lands; the toolbar disables that option. */
  sizeSortAvailable: boolean;
  toggleSort: (key: VideoSortKey) => void;
  loadMore: () => void;
  refresh: () => void;
};

/** What the library returned, and for which sort — the sort it was loaded for is part of the value. */
type LoadedPages = {
  sort: VideoSort;
  videos: LibraryVideo[];
  hasMore: boolean;
};

export function useVideoBrowser(enabled: boolean): VideoBrowser {
  const [sort, setSort] = useState<VideoSort>(() =>
    resolveSort(readStoredSort())
  );
  const [loaded, setLoaded] = useState<LoadedPages | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  // Incremented by pull-to-refresh and by media-library change events to re-run the load effect.
  const [reloadToken, setReloadToken] = useState(0);

  // Bumped on every load so a slow in-flight page cannot overwrite a newer one.
  const generation = useRef(0);
  const loadingMore = useRef(false);
  // Sorting by size needs the whole library ranked before any of it can be shown.
  const sizeSorted = useRef<LibraryVideo[]>(NO_VIDEOS);

  // Loading is derived, not stored: a result belonging to a different sort *is* the loading state.
  const current = loaded && sameSort(loaded.sort, sort) ? loaded : null;
  const status: BrowserStatus = failed
    ? 'error'
    : current
      ? 'ready'
      : 'loading';

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const request = ++generation.current;
    loadingMore.current = false;

    void (async () => {
      try {
        if (sortsBySize(sort)) {
          const ranked = await rankBySize(sort.direction);
          if (!active) return;

          sizeSorted.current = ranked;
          setTotalCount(ranked.length);
          setLoaded({
            sort,
            videos: ranked.slice(0, PAGE_SIZE),
            hasMore: ranked.length > PAGE_SIZE,
          });
          setFailed(false);
          return;
        }

        const page = await listVideos({
          ...mediaStoreSort(sort),
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (!active) return;

        setLoaded({ sort, videos: page.videos, hasMore: page.hasMore });
        setFailed(false);
      } catch (error) {
        if (!active) return;
        console.warn('[library] failed to load videos', error);
        setFailed(true);
        return;
      } finally {
        if (active) setRefreshing(false);
      }

      // The header count needs the whole library; it must never delay the first page.
      try {
        const ids = await listAllVideoIds();
        if (active && request === generation.current) setTotalCount(ids.length);
      } catch (error) {
        console.warn('[library] failed to count videos', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, reloadToken, sort]);

  useEffect(() => {
    if (!enabled) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const subscription = subscribeToLibraryChanges(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => setReloadToken(token => token + 1),
        CHANGE_DEBOUNCE_MS
      );
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.remove();
    };
  }, [enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || loadingMore.current || !current?.hasMore) return;

    // A size sort is already ranked in memory; paging it is a slice, not another query.
    if (sortsBySize(sort)) {
      const ranked = sizeSorted.current;
      const next = ranked.slice(0, current.videos.length + PAGE_SIZE);
      setLoaded({ sort, videos: next, hasMore: ranked.length > next.length });
      return;
    }

    const request = generation.current;
    loadingMore.current = true;

    void (async () => {
      try {
        const page = await listVideos({
          ...mediaStoreSort(sort),
          limit: PAGE_SIZE,
          offset: current.videos.length,
        });
        if (request !== generation.current) return;

        setLoaded(previous =>
          previous && sameSort(previous.sort, sort)
            ? {
                ...previous,
                // Offset paging can repeat a row if the library changed mid-scroll.
                videos: appendNew(previous.videos, page.videos),
                hasMore: page.hasMore,
              }
            : previous
        );
      } catch (error) {
        console.warn('[library] failed to load more videos', error);
      } finally {
        loadingMore.current = false;
      }
    })();
  }, [current, enabled, sort]);

  const toggleSort = useCallback((key: VideoSortKey) => {
    setSort(previous => {
      const updated = nextSort(previous, key);
      storeSort(updated);
      return updated;
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken(token => token + 1);
  }, []);

  return {
    videos: current?.videos ?? NO_VIDEOS,
    status,
    refreshing,
    hasMore: current?.hasMore ?? true,
    totalCount,
    sort,
    sizeSortAvailable: sizeIndex.available,
    toggleSort,
    loadMore,
    refresh,
  };
}

/**
 * The media store cannot sort by size, so until the size index exists that choice falls back to a
 * sort it can perform. The toolbar disables the option, so this only guards a preference written
 * by a later build.
 */
const SIZE_SORT_FALLBACK: MediaStoreSortKey = 'createdAt';

function resolveSort(stored: VideoSort): VideoSort {
  return stored.key === 'size' && !sizeIndex.available ? DEFAULT_SORT : stored;
}

function sortsBySize(sort: VideoSort): boolean {
  return sort.key === 'size' && sizeIndex.available;
}

/**
 * §4: the media store cannot order by size, so the whole library is indexed and ranked here.
 * Assets whose size could not be read sort last rather than pretending to be zero bytes.
 */
async function rankBySize(
  direction: VideoSort['direction']
): Promise<LibraryVideo[]> {
  const all = await listAllVideos();
  await sizeIndex.ensure(all);

  const sign = direction === 'asc' ? 1 : -1;
  return [...all].sort((a, b) => {
    const sizeA = sizeIndex.get(a);
    const sizeB = sizeIndex.get(b);
    if (sizeA === null) return sizeB === null ? 0 : 1;
    if (sizeB === null) return -1;
    return (sizeA - sizeB) * sign;
  });
}

function mediaStoreSort(sort: VideoSort): {
  key: MediaStoreSortKey;
  direction: VideoSort['direction'];
} {
  return {
    key: sort.key === 'size' ? SIZE_SORT_FALLBACK : sort.key,
    direction: sort.direction,
  };
}

function sameSort(a: VideoSort, b: VideoSort): boolean {
  return a.key === b.key && a.direction === b.direction;
}

function appendNew(
  existing: LibraryVideo[],
  incoming: LibraryVideo[]
): LibraryVideo[] {
  const seen = new Set(existing.map(video => video.id));
  const fresh = incoming.filter(video => !seen.has(video.id));
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}
