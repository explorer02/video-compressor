import { openJsonStore } from '../storage';
import {
  DEFAULT_SORT,
  DURATION_FILTER_THRESHOLDS,
  SIZE_FILTER_THRESHOLDS,
  type DurationFilter,
  type FilterDirection,
  type SizeFilter,
  type SortDirection,
  type VideoSort,
  type VideoSortKey,
} from './types';

/** The browser's sort and filters survive relaunches (§4). */

const STORE = 'preferences';
const KEY = 'videoSort';
const SIZE_FILTER_KEY = 'sizeFilter';
const DURATION_FILTER_KEY = 'durationFilter';

const SORT_KEYS: VideoSortKey[] = ['size', 'createdAt', 'modifiedAt'];
const DIRECTIONS: SortDirection[] = ['asc', 'desc'];

export function readStoredSort(): VideoSort {
  const stored = openJsonStore(STORE).get<unknown>(KEY);
  return isVideoSort(stored) ? stored : DEFAULT_SORT;
}

export function storeSort(sort: VideoSort): void {
  openJsonStore(STORE).set(KEY, sort);
}

const FILTER_DIRECTIONS: FilterDirection[] = ['atLeast', 'under'];

export function readStoredSizeFilter(): SizeFilter {
  const stored = openJsonStore(STORE).get<unknown>(SIZE_FILTER_KEY);
  if (isSizeFilter(stored)) return stored;

  // Builds before the direction existed stored the bare threshold; those were all "at least".
  if (typeof stored === 'number' && SIZE_FILTER_THRESHOLDS.includes(stored)) {
    return { direction: 'atLeast', bytes: stored };
  }

  // Anything else the app no longer offers is discarded rather than guessed at.
  return null;
}

export function storeSizeFilter(filter: SizeFilter): void {
  openJsonStore(STORE).set(SIZE_FILTER_KEY, filter);
}

export function readStoredDurationFilter(): DurationFilter {
  const stored = openJsonStore(STORE).get<unknown>(DURATION_FILTER_KEY);
  return isDurationFilter(stored) ? stored : null;
}

export function storeDurationFilter(filter: DurationFilter): void {
  openJsonStore(STORE).set(DURATION_FILTER_KEY, filter);
}

/** Tapping the active sort reverses it; tapping another switches to it, newest/largest first. */
export function nextSort(current: VideoSort, key: VideoSortKey): VideoSort {
  if (current.key !== key) return { key, direction: 'desc' };
  return {
    key,
    direction: current.direction === 'desc' ? 'asc' : 'desc',
  };
}

function isSizeFilter(value: unknown): value is NonNullable<SizeFilter> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NonNullable<SizeFilter>>;
  return (
    FILTER_DIRECTIONS.includes(candidate.direction as FilterDirection) &&
    SIZE_FILTER_THRESHOLDS.includes(candidate.bytes as number)
  );
}

function isDurationFilter(
  value: unknown
): value is NonNullable<DurationFilter> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NonNullable<DurationFilter>>;
  return (
    FILTER_DIRECTIONS.includes(candidate.direction as FilterDirection) &&
    DURATION_FILTER_THRESHOLDS.includes(candidate.ms as number)
  );
}

function isVideoSort(value: unknown): value is VideoSort {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VideoSort>;
  return (
    SORT_KEYS.includes(candidate.key as VideoSortKey) &&
    DIRECTIONS.includes(candidate.direction as SortDirection)
  );
}
