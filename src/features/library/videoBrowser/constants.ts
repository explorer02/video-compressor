import type { LibraryVideo } from '../../../core/videoLibrary';

/** §4: ~60 rows per page, infinite scroll. */
export const PAGE_SIZE = 60;

/** The media library emits a burst of events after a save or delete — collapse them. */
export const CHANGE_DEBOUNCE_MS = 400;

export const NO_VIDEOS: LibraryVideo[] = [];
