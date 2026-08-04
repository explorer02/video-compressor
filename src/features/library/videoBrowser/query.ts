/** How the browser asks the media store: which views need a full scan, and how each is resolved. */

import { sizeIndex } from '../../../core/sizeIndex';
import {
  DEFAULT_SORT,
  listAllVideos,
  matchesDurationFilter,
  matchesSizeFilter,
  sameDurationFilter,
  sameSizeFilter,
  type DurationFilter,
  type LibraryVideo,
  type MediaStoreSortKey,
  type SizeFilter,
  type VideoSort,
} from '../../../core/videoLibrary';
import type { LoadedPages } from './types';

/**
 * The media store cannot sort by size, so until the size index exists that choice falls back to a
 * sort it can perform. The toolbar disables the option, so this only guards a preference written
 * by a later build.
 */
const SIZE_SORT_FALLBACK: MediaStoreSortKey = 'createdAt';

export function resolveSort(stored: VideoSort): VideoSort {
  return stored.key === 'size' && !sizeIndex.available ? DEFAULT_SORT : stored;
}

/**
 * Sorting or filtering by size needs every size known, and filtering by duration needs every row
 * seen before any page can claim to be complete — the media store can answer neither. All three
 * share one path: read the whole library, then filter, rank and page in memory.
 */
export function needsFullScan(
  sort: VideoSort,
  sizeFilter: SizeFilter,
  durationFilter: DurationFilter
): boolean {
  if (durationFilter !== null) return true;
  if (!sizeIndex.available) return false;
  return sort.key === 'size' || sizeFilter !== null;
}

export async function scanLibrary(
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

export function mediaStoreSort(sort: VideoSort): {
  key: MediaStoreSortKey;
  direction: VideoSort['direction'];
} {
  return {
    key: sort.key === 'size' ? SIZE_SORT_FALLBACK : sort.key,
    direction: sort.direction,
  };
}

export function matchesView(
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

export function appendNew(
  existing: LibraryVideo[],
  incoming: LibraryVideo[]
): LibraryVideo[] {
  const seen = new Set(existing.map(video => video.id));
  const fresh = incoming.filter(video => !seen.has(video.id));
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}
