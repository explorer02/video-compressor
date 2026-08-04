import { useCallback, useEffect, useRef, useState } from 'react';

import { sizeIndex } from '../../../core/sizeIndex';
import {
  listAllVideoIds,
  listAllVideos,
  listVideos,
  nextSort,
  readStoredDurationFilter,
  readStoredSizeFilter,
  readStoredSort,
  storeDurationFilter,
  storeSizeFilter,
  storeSort,
  subscribeToLibraryChanges,
  type DurationFilter,
  type LibraryVideo,
  type SizeFilter,
  type VideoSort,
  type VideoSortKey,
} from '../../../core/videoLibrary';
import { CHANGE_DEBOUNCE_MS, NO_VIDEOS, PAGE_SIZE } from './constants';
import {
  appendNew,
  matchesView,
  mediaStoreSort,
  needsFullScan,
  resolveSort,
  scanLibrary,
} from './query';
import type { BrowserStatus, LoadedPages, VideoBrowser } from './types';

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
