import type {
  DurationFilter,
  LibraryVideo,
  SizeFilter,
  VideoSort,
  VideoSortKey,
} from '../../../core/videoLibrary';

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
export type LoadedPages = {
  sort: VideoSort;
  sizeFilter: SizeFilter;
  durationFilter: DurationFilter;
  videos: LibraryVideo[];
  hasMore: boolean;
};
