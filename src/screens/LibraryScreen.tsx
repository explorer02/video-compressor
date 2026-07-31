import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatBytes } from '../core/format';
import type { LibraryVideo, MediaAccessState } from '../core/videoLibrary';
import { SortToolbar } from '../features/library/SortToolbar';
import { useVideoBrowser } from '../features/library/useVideoBrowser';
import { useVideoSizes } from '../features/library/useVideoSizes';
import { VideoRow } from '../features/library/VideoRow';
import { colors, spacing } from '../theme';
import { AppText, Banner, EmptyState, Screen } from '../ui';

export type LibraryScreenProps = {
  access: MediaAccessState;
  onSelect: (video: LibraryVideo) => void;
};

/** The §4 video browser: the app's home screen and its only entry point into compression. */
export function LibraryScreen({ access, onSelect }: LibraryScreenProps) {
  const browser = useVideoBrowser(
    access.access === 'granted' || access.access === 'limited'
  );
  const sizes = useVideoSizes(browser.videos);

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => (
      <VideoRow
        video={item}
        sortKey={browser.sort.key}
        sizeBytes={sizes.sizeOf(item)}
        onPress={onSelect}
      />
    ),
    [browser.sort.key, onSelect, sizes]
  );

  return (
    <Screen edges={{ bottom: false }}>
      <View style={styles.header}>
        <AppText variant="title">Videos</AppText>
        <AppText variant="caption" tone="muted">
          {sizes.indexing
            ? 'Indexing sizes…'
            : headerSubtitle(
                browser.totalCount,
                browser.videos.length,
                sizes.totalBytes
              )}
        </AppText>
      </View>

      <SortToolbar
        sort={browser.sort}
        sizeSortAvailable={browser.sizeSortAvailable}
        onToggle={browser.toggleSort}
      />

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

function headerSubtitle(
  totalCount: number | null,
  loaded: number,
  totalBytes: number | null
): string {
  if (totalCount === null) return loaded > 0 ? `${loaded}+ videos` : 'Loading…';

  const count = `${totalCount} ${plural(totalCount, 'video')}`;
  return totalBytes === null ? count : `${count} · ${formatBytes(totalBytes)}`;
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
  placeholder: { paddingVertical: spacing.xxl, alignItems: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
