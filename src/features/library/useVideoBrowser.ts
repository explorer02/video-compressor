import { useCallback, useEffect, useRef, useState } from 'react';

import { sizeIndex } from '../../core/sizeIndex';
import {
  DEFAULT_SORT,
  listAllVideoIds,
  listAllVideos,
  listVideos,
  matchesDurationFilter,
  matchesSizeFilter,
  nextSort,
  readStoredDurationFilter,
  readStoredSizeFilter,
  readStoredSort,
  sameDurationFilter,
  sameSizeFilter,
  storeDurationFilter,
  storeSizeFilter,
  storeSort,
  subscribeToLibraryChanges,
  type DurationFilter,
  type LibraryVideo,
  type MediaStoreSortKey,
  type SizeFilter,
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
  /** Videos matching the current filter. Null until the count pass finishes. */
  totalCount: number | null;
  /** Videos in the library regardless of filter, so a filtered list reads as filtered. */
  libraryCount: number | null;
  sort: VideoSort;
  sizeFilter: SizeFilter;
  durationFilter: DurationFilter;
  /** False until the size index lands; the toolbar disables both size options. */
  sizeSortAvailable: boolean;
  toggleSort: (key: VideoSortKey) => void;
  setSizeFilter: (filter: SizeFilter) => void;
  setDurationFilter: (filter: DurationFilter) => void;
  loadMore: () => void;
  refresh: () => void;
  /** Every video in the current view, not just the pages fetched so far. Feeds "Select all". */
  listAllInView: () => Promise<LibraryVideo[]>;
};

/** What the library returned, and for which view — the query it answers is part of the value. */
type LoadedPages = {
  sort: VideoSort;
  sizeFilter: SizeFilter;
  durationFilter: DurationFilter;
  videos: LibraryVideo[];
  hasMore: boolean;
};

export function useVideoBrowser(enabled: boolean): VideoBrowser {
  const [sort, setSort] = useState<VideoSort>(() =>
    resolveSort(readStoredSort())
  );
  const [sizeFilter, setStoredSizeFilter] = useState<SizeFilter>(() =>
    sizeIndex.available ? readStoredSizeFilter() : null
  );
  const [durationFilter, setStoredDurationFilter] = useState<DurationFilter>(
    readStoredDurationFilter
  );
  const [loaded, setLoaded] = useState<LoadedPages | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  // Incremented by pull-to-refresh and by media-library change events to re-run the load effect.
  const [reloadToken, setReloadToken] = useState(0);

  // Bumped on every load so a slow in-flight page cannot overwrite a newer one.
  const generation = useRef(0);
  const loadingMore = useRef(false);
  // Sorting or filtering by size needs the whole library resolved before any of it can be shown.
  const scanned = useRef<LibraryVideo[]>(NO_VIDEOS);

  // Loading is derived, not stored: a result belonging to a different query *is* the loading state.
  const current =
    loaded && matchesView(loaded, sort, sizeFilter, durationFilter)
      ? loaded
      : null;
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
        if (needsFullScan(sort, sizeFilter, durationFilter)) {
          const matching = await scanLibrary(sort, sizeFilter, durationFilter);
          if (!active) return;

          scanned.current = matching;
          setTotalCount(matching.length);
          setLoaded({
            sort,
            sizeFilter,
            durationFilter,
            videos: matching.slice(0, PAGE_SIZE),
            hasMore: matching.length > PAGE_SIZE,
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

        setLoaded({
          sort,
          sizeFilter,
          durationFilter,
          videos: page.videos,
          hasMore: page.hasMore,
        });
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
        if (!active || request !== generation.current) return;
        // The id list is the truth about what still exists — drop size-index entries for
        // anything gone, so the header's total size follows deletes and replaces.
        sizeIndex.prune(ids);
        setLibraryCount(ids.length);
        if (sizeFilter === null && durationFilter === null) {
          setTotalCount(ids.length);
        }
      } catch (error) {
        console.warn('[library] failed to count videos', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [durationFilter, enabled, reloadToken, sizeFilter, sort]);

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

    // A scanned view is already resolved in memory; paging it is a slice, not another query.
    if (needsFullScan(sort, sizeFilter, durationFilter)) {
      const next = scanned.current.slice(0, current.videos.length + PAGE_SIZE);
      setLoaded({
        sort,
        sizeFilter,
        durationFilter,
        videos: next,
        hasMore: scanned.current.length > next.length,
      });
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
          previous && matchesView(previous, sort, sizeFilter, durationFilter)
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
  }, [current, durationFilter, enabled, sizeFilter, sort]);

  const toggleSort = useCallback((key: VideoSortKey) => {
    setSort(previous => {
      const updated = nextSort(previous, key);
      storeSort(updated);
      return updated;
    });
  }, []);

  const setSizeFilter = useCallback((filter: SizeFilter) => {
    storeSizeFilter(filter);
    setStoredSizeFilter(filter);
  }, []);

  const setDurationFilter = useCallback((filter: DurationFilter) => {
    storeDurationFilter(filter);
    setStoredDurationFilter(filter);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken(token => token + 1);
  }, []);

  const listAllInView = useCallback(async (): Promise<LibraryVideo[]> => {
    // A scanned view already holds every match in memory; anything else asks the store for all of
    // it in one read — the same query the pages come from, without the pagination.
    if (needsFullScan(sort, sizeFilter, durationFilter)) {
      return current
        ? scanned.current
        : scanLibrary(sort, sizeFilter, durationFilter);
    }
    return listAllVideos(mediaStoreSort(sort));
  }, [current, durationFilter, sizeFilter, sort]);

  return {
    videos: current?.videos ?? NO_VIDEOS,
    status,
    refreshing,
    hasMore: current?.hasMore ?? true,
    totalCount,
    libraryCount,
    sort,
    sizeFilter,
    durationFilter,
    sizeSortAvailable: sizeIndex.available,
    toggleSort,
    setSizeFilter,
    setDurationFilter,
    loadMore,
    refresh,
    listAllInView,
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

/**
 * Sorting or filtering by size needs every size known, and filtering by duration needs every row
 * seen before any page can claim to be complete — the media store can answer neither. All three
 * share one path: read the whole library, then filter, rank and page in memory.
 */
function needsFullScan(
  sort: VideoSort,
  sizeFilter: SizeFilter,
  durationFilter: DurationFilter
): boolean {
  if (durationFilter !== null) return true;
  if (!sizeIndex.available) return false;
  return sort.key === 'size' || sizeFilter !== null;
}

async function scanLibrary(
  sort: VideoSort,
  sizeFilter: SizeFilter,
  durationFilter: DurationFilter
): Promise<LibraryVideo[]> {
  const all = await listAllVideos(mediaStoreSort(sort));
  // A full read is also the moment to forget sizes of assets that no longer exist (see prune).
  sizeIndex.prune(all.map(video => video.id));

  // Duration rides along in every media-store row; only size needs the index resolved.
  const needsSizes =
    sizeIndex.available && (sort.key === 'size' || sizeFilter !== null);
  if (needsSizes) await sizeIndex.ensure(all);

  // A video whose size or duration is unknown is left out of a filtered view rather than counted
  // as 0 — an "under 10 MB" or "under 30 s" list must not claim files nobody has measured.
  let matching = all;
  if (durationFilter !== null) {
    matching = matching.filter(
      video =>
        video.durationMs !== null &&
        matchesDurationFilter(video.durationMs, durationFilter)
    );
  }
  if (sizeFilter !== null) {
    matching = matching.filter(video => {
      const sizeBytes = sizeIndex.get(video);
      return sizeBytes !== null && matchesSizeFilter(sizeBytes, sizeFilter);
    });
  }

  return sort.key === 'size' ? rankBySize(matching, sort.direction) : matching;
}

/** Assets whose size could not be read sort last rather than pretending to be zero bytes. */
function rankBySize(
  videos: LibraryVideo[],
  direction: VideoSort['direction']
): LibraryVideo[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...videos].sort((a, b) => {
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

function matchesView(
  loaded: LoadedPages,
  sort: VideoSort,
  sizeFilter: SizeFilter,
  durationFilter: DurationFilter
): boolean {
  return (
    loaded.sort.key === sort.key &&
    loaded.sort.direction === sort.direction &&
    sameSizeFilter(loaded.sizeFilter, sizeFilter) &&
    sameDurationFilter(loaded.durationFilter, durationFilter)
  );
}

function appendNew(
  existing: LibraryVideo[],
  incoming: LibraryVideo[]
): LibraryVideo[] {
  const seen = new Set(existing.map(video => video.id));
  const fresh = incoming.filter(video => !seen.has(video.id));
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}
