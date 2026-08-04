import { useVideoBrowser } from '../../features/library/videoBrowser';
import { useVideoSelection } from '../../features/library/useVideoSelection';
import { useVideoSizes } from '../../features/library/useVideoSizes';
import { useHardwareBack } from '../../ui';
import { useSelectAll } from './hooks/useSelectAll';
import { useSelectionActions } from './hooks/useSelectionActions';
import type { LibraryScreenProps } from './LibraryScreen';
import { headerSubtitle } from './utils';

/** All of the library's state and verbs; the screen component only renders it. */
export function useLibraryScreen({
  access,
  onCompressMany,
}: Pick<LibraryScreenProps, 'access' | 'onCompressMany'>) {
  const browser = useVideoBrowser(
    access.access === 'granted' || access.access === 'limited'
  );
  const sizes = useVideoSizes(browser.videos);
  const selection = useVideoSelection();
  const selectAll = useSelectAll(browser, selection);
  const actions = useSelectionActions({ selection, onCompressMany });

  // Hardware back leaves selection mode the way Android galleries do, instead of exiting the app.
  useHardwareBack(selection.active ? selection.exit : null);

  const subtitle = sizes.indexing
    ? 'Indexing sizes…'
    : headerSubtitle(browser, sizes);

  return { browser, sizes, selection, selectAll, actions, subtitle };
}
