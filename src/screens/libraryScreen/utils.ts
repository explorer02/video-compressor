import { formatBytes } from '../../core/format';
import { durationFilterLabel } from '../../features/library/DurationFilterControl';
import { sizeFilterLabel } from '../../features/library/SizeFilterControl';
import type { VideoBrowser } from '../../features/library/videoBrowser';
import type { VideoSizes } from '../../features/library/useVideoSizes';
import { plural } from '../../utils/text';

/** A filtered count reads as filtered, so a short list is never mistaken for a small library. */
export function headerSubtitle(
  browser: VideoBrowser,
  sizes: VideoSizes
): string {
  const { totalCount, libraryCount, videos } = browser;

  if (totalCount === null) {
    return videos.length > 0 ? `${videos.length}+ videos` : 'Loading…';
  }

  const filters = activeFilterLabels(browser);
  if (filters.length > 0 && libraryCount !== null) {
    return `${totalCount} of ${libraryCount} videos · ${filters.join(' · ')}`;
  }

  const count = `${totalCount} ${plural(totalCount, 'video')}`;
  return sizes.totalBytes === null
    ? count
    : `${count} · ${formatBytes(sizes.totalBytes)}`;
}

/** The active filters, worded exactly as their chips are. */
export function activeFilterLabels(browser: VideoBrowser): string[] {
  const labels: string[] = [];
  if (browser.sizeFilter !== null) {
    labels.push(sizeFilterLabel(browser.sizeFilter));
  }
  if (browser.durationFilter !== null) {
    labels.push(durationFilterLabel(browser.durationFilter));
  }
  return labels;
}
