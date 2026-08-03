import { FlashList } from '@shopify/flash-list';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatBytes } from '../core/format';
import type { LibraryVideo, MediaAccessState } from '../core/videoLibrary';
import {
  DurationFilterControl,
  durationFilterLabel,
} from '../features/library/DurationFilterControl';
import {
  SizeFilterControl,
  sizeFilterLabel,
} from '../features/library/SizeFilterControl';
import { SortToolbar } from '../features/library/SortToolbar';
import { useDeleteVideos } from '../features/library/useDeleteVideos';
import { useVideoBrowser } from '../features/library/useVideoBrowser';
import { useVideoSelection } from '../features/library/useVideoSelection';
import { useVideoSizes } from '../features/library/useVideoSizes';
import { VideoRow } from '../features/library/VideoRow';
import { colors, spacing } from '../theme';
import {
  AppText,
  Banner,
  Button,
  EmptyState,
  Screen,
  useHardwareBack,
  useToast,
} from '../ui';

export type LibraryScreenProps = {
  access: MediaAccessState;
  onSelect: (video: LibraryVideo) => void;
  /** The multi-select "Compress" action — hands the selection to the batch flow. */
  onCompressMany: (videos: LibraryVideo[]) => void;
};

/** The §4 video browser: the app's home screen and its only entry point into compression. */
export function LibraryScreen({
  access,
  onSelect,
  onCompressMany,
}: LibraryScreenProps) {
  const toast = useToast();
  const browser = useVideoBrowser(
    access.access === 'granted' || access.access === 'limited'
  );
  const sizes = useVideoSizes(browser.videos);
  const selection = useVideoSelection();

  const deletion = useDeleteVideos({
    onDeleted: message => {
      toast.show(message, 'success');
      selection.exit();
    },
    onKept: message => {
      toast.show(message);
      selection.exit();
    },
    onFailed: message => toast.show(message, 'danger'),
  });

  // Hardware back leaves selection mode the way Android galleries do, instead of exiting the app.
  useHardwareBack(selection.active ? selection.exit : null);

  // "All" means the whole view, not the pages scrolled in so far — hence the count comparison
  // against the view's total and the async fetch when selecting.
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

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => (
      <VideoRow
        video={item}
        sortKey={browser.sort.key}
        sizeBytes={sizes.sizeOf(item)}
        selected={selection.active ? selection.isSelected(item) : null}
        // In selection mode a tap toggles rather than opens, so the two never conflict — and a
        // long press toggles too, so holding a second row never resets the selection to just it.
        onPress={selection.active ? selection.toggle : onSelect}
        onLongPress={selection.active ? selection.toggle : selection.begin}
      />
    ),
    [browser.sort.key, onSelect, selection, sizes]
  );

  return (
    <Screen edges={{ bottom: false }}>
      {selection.active ? (
        <SelectionBar
          count={selection.count}
          allSelected={allSelected}
          selectingAll={selectingAll}
          busy={deletion.busy}
          onToggleAll={toggleSelectAll}
          onCompress={() => {
            const videos = selection.videos;
            selection.exit();
            onCompressMany(videos);
          }}
          onDelete={() => deletion.remove(selection.videos)}
          onDone={selection.exit}
        />
      ) : (
        <View style={styles.header}>
          <AppText variant="title">Videos</AppText>
          <AppText variant="caption" tone="muted">
            {sizes.indexing
              ? 'Indexing sizes…'
              : headerSubtitle(browser, sizes)}
          </AppText>
        </View>
      )}

      <View style={styles.controls}>
        <SortToolbar
          sort={browser.sort}
          sizeSortAvailable={browser.sizeSortAvailable}
          onToggle={browser.toggleSort}
        />
        <View style={styles.filters}>
          <SizeFilterControl
            value={browser.sizeFilter}
            disabled={!browser.sizeSortAvailable}
            onChange={browser.setSizeFilter}
          />
          <DurationFilterControl
            value={browser.durationFilter}
            onChange={browser.setDurationFilter}
          />
        </View>
      </View>

      {access.access === 'limited' ? (
        <Banner
          message="ShortenAF can only see the videos you selected."
          action={{
            label: 'Manage access',
            onPress: () => void access.manageAccess(),
          }}
        />
      ) : null}

      <FlashList
        data={browser.videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Selection state lives outside the row data, so rows must be told when it changes.
        extraData={selection}
        onEndReached={browser.loadMore}
        onEndReachedThreshold={0.6}
        refreshing={browser.refreshing}
        onRefresh={browser.refresh}
        ListEmptyComponent={
          <LibraryPlaceholder browser={browser} access={access} />
        }
        ListFooterComponent={
          browser.hasMore && browser.videos.length > 0 ? <Footer /> : null
        }
      />
    </Screen>
  );
}

/**
 * Replaces the header while selecting: the count where the title was, the actions on one row.
 * "Delete" carries the count so the destructive button always says how much it will destroy.
 */
function SelectionBar({
  count,
  allSelected,
  selectingAll,
  busy,
  onToggleAll,
  onCompress,
  onDelete,
  onDone,
}: {
  count: number;
  allSelected: boolean;
  selectingAll: boolean;
  busy: boolean;
  onToggleAll: () => void;
  onCompress: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.selectionBar}>
      <View style={styles.selectionTitle}>
        <AppText variant="title">
          {count === 0 ? 'Select' : String(count)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {count === 0 ? 'Tap videos to select them' : 'selected'}
        </AppText>
      </View>

      <View style={styles.selectionActions}>
        <Button
          label={allSelected ? 'Deselect all' : 'Select all'}
          variant="secondary"
          size="sm"
          busy={selectingAll}
          onPress={onToggleAll}
        />
        <Button
          label={count > 0 ? `Compress (${count})` : 'Compress'}
          size="sm"
          disabled={count === 0 || busy}
          onPress={onCompress}
        />
        <Button
          label={count > 0 ? `Delete (${count})` : 'Delete'}
          variant="danger"
          size="sm"
          busy={busy}
          disabled={count === 0}
          onPress={onDelete}
        />
        <Button label="Done" variant="ghost" size="sm" onPress={onDone} />
      </View>
    </View>
  );
}

function LibraryPlaceholder({
  browser,
  access,
}: {
  browser: ReturnType<typeof useVideoBrowser>;
  access: MediaAccessState;
}) {
  if (browser.status === 'loading') {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (browser.status === 'error') {
    return (
      <EmptyState
        title="Couldn't read your videos"
        message="Something went wrong talking to the media library."
        action={{ label: 'Try again', onPress: browser.refresh }}
      />
    );
  }

  // A filter hiding everything is not an empty library, and saying so avoids a pointless hunt.
  const filters = activeFilterLabels(browser);
  if (filters.length > 0) {
    return (
      <EmptyState
        title="No videos match"
        message={`Nothing in your library is ${filters.join(' and ')}.`}
        action={{
          label: filters.length > 1 ? 'Clear filters' : 'Clear filter',
          onPress: () => {
            browser.setSizeFilter(null);
            browser.setDurationFilter(null);
          },
        }}
      />
    );
  }

  return (
    <EmptyState
      title="No videos found"
      message={
        access.access === 'limited'
          ? 'None of the videos you granted access to are available. Add more to see them here.'
          : 'Record or download a video and it will show up here.'
      }
      action={
        access.access === 'limited'
          ? {
              label: 'Manage access',
              onPress: () => void access.manageAccess(),
            }
          : undefined
      }
    />
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function keyExtractor(video: LibraryVideo): string {
  return video.id;
}

/** A filtered count reads as filtered, so a short list is never mistaken for a small library. */
function headerSubtitle(
  browser: ReturnType<typeof useVideoBrowser>,
  sizes: ReturnType<typeof useVideoSizes>
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
function activeFilterLabels(
  browser: ReturnType<typeof useVideoBrowser>
): string[] {
  const labels: string[] = [];
  if (browser.sizeFilter !== null) {
    labels.push(sizeFilterLabel(browser.sizeFilter));
  }
  if (browser.durationFilter !== null) {
    labels.push(durationFilterLabel(browser.durationFilter));
  }
  return labels;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  selectionBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  selectionTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    // The title line keeps the header's height so flipping modes never shifts the list below.
    minHeight: 34,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Sort options and filter chips each get a full row — three sort labels plus two chips never
  // fit one row without truncating into "File …" / "Date…".
  controls: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  placeholder: { paddingVertical: spacing.xxl, alignItems: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
