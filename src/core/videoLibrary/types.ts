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

/**
 * Hides everything below the chosen size, for finding the videos worth acting on.
 * `null` is "no filter" — the whole library.
 */
export type SizeFilter = number | null;

const MB = 1000 * 1000;

/** The offered thresholds, in bytes. The control renders from this list. */
export const SIZE_FILTERS: SizeFilter[] = [
  null,
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
 * Access the user has granted to the video library. `limited` means iOS Limited Photos or the
 * Android 14 "selected videos" grant — a working state with a reduced asset set, not a failure.
 */
export type MediaAccess = 'granted' | 'limited' | 'denied' | 'undetermined';

export type VideoPage = {
  videos: LibraryVideo[];
  /** False once the media store has no more rows past this page. */
  hasMore: boolean;
};
