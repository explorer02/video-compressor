import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { formatBytes } from '../core/format';
import type { LibraryVideo, MediaAccessState } from '../core/videoLibrary';
import { SizeFilterControl } from '../features/library/SizeFilterControl';
import { SortToolbar } from '../features/library/SortToolbar';
import { useDeleteVideos } from '../features/library/useDeleteVideos';
import { useVideoBrowser } from '../features/library/useVideoBrowser';
import { useVideoSelection } from '../features/library/useVideoSelection';
import { useVideoSizes } from '../features/library/useVideoSizes';
import { VideoRow } from '../features/library/VideoRow';
import { colors, spacing } from '../theme';
import { AppText, Banner, Button, EmptyState, Screen, useToast } from '../ui';

export type LibraryScreenProps = {
  access: MediaAccessState;
  onSelect: (video: LibraryVideo) => void;
};

/** The §4 video browser: the app's home screen and its only entry point into compression. */
export function LibraryScreen({ access, onSelect }: LibraryScreenProps) {
  const toast = useToast();
  const browser = useVideoBrowser(
    access.access === 'granted' || access.access === 'limited'
  );
  const sizes = useVideoSizes(browser.videos);
  const selection = useVideoSelection();

  const deletion = useDeleteVideos({
    onDeleted: message => {
      toast.show(message, 'success');
      selection.clear();
    },
    onKept: message => {
      toast.show(message);
      selection.clear();
    },
    onFailed: message => toast.show(message, 'danger'),
  });

  const selectedVideos = browser.videos.filter(selection.isSelected);

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => (
      <VideoRow
        video={item}
        sortKey={browser.sort.key}
        sizeBytes={sizes.sizeOf(item)}
        selected={selection.active ? selection.isSelected(item) : null}
        // In selection mode a tap toggles rather than opens, so the two never conflict.
        onPress={selection.active ? selection.toggle : onSelect}
        onLongPress={selection.begin}
      />
    ),
    [browser.sort.key, onSelect, selection, sizes]
  );

  return (
    <Screen edges={{ bottom: false }}>
      {selection.active ? (
        <SelectionBar
          count={selection.count}
          busy={deletion.busy}
          onSelectAll={() => selection.selectAll(browser.videos)}
          onDelete={() =>
            confirmDelete(selectedVideos.length, () =>
              deletion.remove(selectedVideos)
            )
          }
          onCancel={selection.clear}
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
        <SizeFilterControl
          value={browser.sizeFilter}
          disabled={!browser.sizeSortAvailable}
          onChange={browser.setSizeFilter}
        />
      </View>

      {access.access === 'limited' ? (
        <Banner
          message="CompressHD can only see the videos you selected."
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

function SelectionBar({
  count,
  busy,
  onSelectAll,
  onDelete,
  onCancel,
}: {
  count: number;
  busy: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.selectionBar}>
      <AppText variant="heading">
        {count === 0 ? 'Select videos' : `${count} selected`}
      </AppText>

      <View style={styles.selectionActions}>
        <Button label="All" variant="ghost" onPress={onSelectAll} />
        <Button
          label="Delete"
          variant="danger"
          busy={busy}
          disabled={count === 0}
          onPress={onDelete}
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
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
  if (browser.sizeFilter !== null) {
    return (
      <EmptyState
        title="No videos this large"
        message={`Nothing in your library is ${formatBytes(browser.sizeFilter)} or bigger.`}
        action={{
          label: 'Clear filter',
          onPress: () => browser.setSizeFilter(null),
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

/** Our own warning first; the OS shows its own delete dialog afterwards, which cannot be bypassed. */
function confirmDelete(count: number, onConfirm: () => void): void {
  Alert.alert(
    count === 1 ? 'Delete this video?' : `Delete ${count} videos?`,
    count === 1
      ? 'It will be removed from your device. This can’t be undone.'
      : `They will be removed from your device. This can’t be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]
  );
}

/** A filtered count reads as filtered, so a short list is never mistaken for a small library. */
function headerSubtitle(
  browser: ReturnType<typeof useVideoBrowser>,
  sizes: ReturnType<typeof useVideoSizes>
): string {
  const { totalCount, libraryCount, sizeFilter, videos } = browser;

  if (totalCount === null) {
    return videos.length > 0 ? `${videos.length}+ videos` : 'Loading…';
  }

  if (sizeFilter !== null && libraryCount !== null) {
    return `${totalCount} of ${libraryCount} videos · ≥ ${formatBytes(sizeFilter)}`;
  }

  const count = `${totalCount} ${plural(totalCount, 'video')}`;
  return sizes.totalBytes === null
    ? count
    : `${count} · ${formatBytes(sizes.totalBytes)}`;
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
  selectionActions: { flexDirection: 'row', gap: spacing.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  placeholder: { paddingVertical: spacing.xxl, alignItems: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
