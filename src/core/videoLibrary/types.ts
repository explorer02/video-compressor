/**
 * Domain types for the device video library.
 *
 * Field names carry their units (`durationMs`, `sizeBytes`) because expo-media-library's own
 * `duration` switched between seconds and milliseconds across API generations — the current
 * class-based API returns milliseconds on both platforms.
 */

export type VideoAssetId = string;

/** One row of the browser, built from a cheap media-store read. */
export type LibraryVideo = {
  id: VideoAssetId;
  filename: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** Epoch milliseconds. */
  createdAt: number | null;
  /** Epoch milliseconds. */
  modifiedAt: number | null;
};

export type VideoSortKey = 'size' | 'createdAt' | 'modifiedAt';

export type SortDirection = 'asc' | 'desc';

export type VideoSort = {
  key: VideoSortKey;
  direction: SortDirection;
};

export const DEFAULT_SORT: VideoSort = { key: 'createdAt', direction: 'desc' };

/** `atLeast` finds the videos worth compressing; `under` finds what already fits somewhere. */
export type FilterDirection = 'atLeast' | 'under';

/** Size-specific alias kept where that code reads better. */
export type SizeFilterDirection = FilterDirection;

/**
 * Keeps only videos on one side of a size threshold. `null` is "no filter" — the whole library.
 */
export type SizeFilter = {
  direction: FilterDirection;
  bytes: number;
} | null;

const MB = 1000 * 1000;

/** The offered thresholds, in bytes. The control renders from this list. */
export const SIZE_FILTER_THRESHOLDS: number[] = [
  1 * MB,
  2 * MB,
  5 * MB,
  10 * MB,
  20 * MB,
  50 * MB,
  100 * MB,
  500 * MB,
];

/**
 * Keeps only videos on one side of a duration threshold. `null` is "no filter".
 */
export type DurationFilter = {
  direction: FilterDirection;
  ms: number;
} | null;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** The offered thresholds, in milliseconds. The control renders from this list. */
export const DURATION_FILTER_THRESHOLDS: number[] = [
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  20 * SECOND_MS,
  30 * SECOND_MS,
  1 * MINUTE_MS,
  5 * MINUTE_MS,
];

/** Value equality — filters are objects, so `===` only ever matches "no filter". */
export function sameSizeFilter(a: SizeFilter, b: SizeFilter): boolean {
  if (a === null || b === null) return a === b;
  return a.direction === b.direction && a.bytes === b.bytes;
}

export function sameDurationFilter(
  a: DurationFilter,
  b: DurationFilter
): boolean {
  if (a === null || b === null) return a === b;
  return a.direction === b.direction && a.ms === b.ms;
}

export function matchesSizeFilter(
  sizeBytes: number,
  filter: NonNullable<SizeFilter>
): boolean {
  return matchesThreshold(sizeBytes, filter.direction, filter.bytes);
}

export function matchesDurationFilter(
  durationMs: number,
  filter: NonNullable<DurationFilter>
): boolean {
  return matchesThreshold(durationMs, filter.direction, filter.ms);
}

function matchesThreshold(
  actual: number,
  direction: FilterDirection,
  threshold: number
): boolean {
  return direction === 'atLeast' ? actual >= threshold : actual < threshold;
}

/**
 * Access the user has granted to the video library. `limited` means iOS Limited Photos or the
 * Android 14 "selected videos" grant — a working state with a reduced asset set, not a failure.
 */
export type MediaAccess = 'granted' | 'limited' | 'denied' | 'undetermined';

export type VideoPage = {
  videos: LibraryVideo[];
  /** False once the media store has no more rows past this page. */
  hasMore: boolean;
};
