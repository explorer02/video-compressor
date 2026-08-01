import { openJsonStore } from '../storage';
import {
  DEFAULT_SORT,
  SIZE_FILTERS,
  type SizeFilter,
  type SortDirection,
  type VideoSort,
  type VideoSortKey,
} from './types';

/** The browser's sort and size filter survive relaunches (§4). */

const STORE = 'preferences';
const KEY = 'videoSort';
const SIZE_FILTER_KEY = 'sizeFilter';

const SORT_KEYS: VideoSortKey[] = ['size', 'createdAt', 'modifiedAt'];
const DIRECTIONS: SortDirection[] = ['asc', 'desc'];

export function readStoredSort(): VideoSort {
  const stored = openJsonStore(STORE).get<unknown>(KEY);
  return isVideoSort(stored) ? stored : DEFAULT_SORT;
}

export function storeSort(sort: VideoSort): void {
  openJsonStore(STORE).set(KEY, sort);
}

export function readStoredSizeFilter(): SizeFilter {
  const stored = openJsonStore(STORE).get<unknown>(SIZE_FILTER_KEY);
  // Only a threshold the app still offers; a stored value from an older build is discarded.
  return SIZE_FILTERS.includes(stored as SizeFilter)
    ? (stored as SizeFilter)
    : null;
}

export function storeSizeFilter(filter: SizeFilter): void {
  openJsonStore(STORE).set(SIZE_FILTER_KEY, filter);
}

/** Tapping the active sort reverses it; tapping another switches to it, newest/largest first. */
export function nextSort(current: VideoSort, key: VideoSortKey): VideoSort {
  if (current.key !== key) return { key, direction: 'desc' };
  return {
    key,
    direction: current.direction === 'desc' ? 'asc' : 'desc',
  };
}

function isVideoSort(value: unknown): value is VideoSort {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VideoSort>;
  return (
    SORT_KEYS.includes(candidate.key as VideoSortKey) &&
    DIRECTIONS.includes(candidate.direction as SortDirection)
  );
}
