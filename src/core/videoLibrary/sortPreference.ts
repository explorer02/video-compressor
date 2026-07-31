import { openJsonStore } from '../storage';
import {
  DEFAULT_SORT,
  type SortDirection,
  type VideoSort,
  type VideoSortKey,
} from './types';

/** The browser's sort survives relaunches (§4). */

const STORE = 'preferences';
const KEY = 'videoSort';

const SORT_KEYS: VideoSortKey[] = ['size', 'createdAt', 'modifiedAt'];
const DIRECTIONS: SortDirection[] = ['asc', 'desc'];

export function readStoredSort(): VideoSort {
  const stored = openJsonStore(STORE).get<unknown>(KEY);
  return isVideoSort(stored) ? stored : DEFAULT_SORT;
}

export function storeSort(sort: VideoSort): void {
  openJsonStore(STORE).set(KEY, sort);
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
