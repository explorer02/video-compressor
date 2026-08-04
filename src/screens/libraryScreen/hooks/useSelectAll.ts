import { useCallback, useState } from 'react';

import type { VideoBrowser } from '../../../features/library/videoBrowser';
import type { VideoSelection } from '../../../features/library/useVideoSelection';
import { useToast } from '../../../ui';

export type SelectAll = {
  /** True when every video in the current view is selected. */
  allSelected: boolean;
  /** True while the whole view is being fetched for "Select all". */
  selectingAll: boolean;
  toggleSelectAll: () => void;
};

/**
 * "Select all" against the whole view, not the pages scrolled in so far — hence the count
 * comparison against the view's total and the async fetch when selecting.
 */
export function useSelectAll(
  browser: VideoBrowser,
  selection: VideoSelection
): SelectAll {
  const toast = useToast();

  const allSelected =
    browser.totalCount !== null &&
    browser.totalCount > 0 &&
    selection.count === browser.totalCount;

  const [selectingAll, setSelectingAll] = useState(false);
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      selection.selectNone();
      return;
    }
    setSelectingAll(true);
    void (async () => {
      try {
        selection.selectAll(await browser.listAllInView());
      } catch (error) {
        console.warn('[library] failed to select all videos', error);
        toast.show('Could not select every video.', 'danger');
      } finally {
        setSelectingAll(false);
      }
    })();
  }, [allSelected, browser, selection, toast]);

  return { allSelected, selectingAll, toggleSelectAll };
}
