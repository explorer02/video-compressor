import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { View } from 'react-native';

import type { LibraryVideo, MediaAccessState } from '../../core/videoLibrary';
import { DurationFilterControl } from '../../features/library/DurationFilterControl';
import { SizeFilterControl } from '../../features/library/SizeFilterControl';
import { SortToolbar } from '../../features/library/SortToolbar';
import { VideoRow } from '../../features/library/VideoRow';
import { Banner, Screen } from '../../ui';
import { keyById } from '../../utils/list';
import { LibraryHeader } from './components/LibraryHeader';
import { LibraryPlaceholder } from './components/LibraryPlaceholder';
import { ListFooterSpinner } from './components/ListFooterSpinner';
import { SelectionBar } from './components/SelectionBar';
import { styles } from './styles';
import { useLibraryScreen } from './useLibraryScreen';

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
  const { browser, sizes, selection, selectAll, actions, subtitle } =
    useLibraryScreen({ access, onCompressMany });

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
          allSelected={selectAll.allSelected}
          selectingAll={selectAll.selectingAll}
          busy={actions.deleting}
          onToggleAll={selectAll.toggleSelectAll}
          onCompress={actions.compressSelection}
          onDelete={actions.deleteSelection}
          onDone={selection.exit}
        />
      ) : (
        <LibraryHeader subtitle={subtitle} />
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
        keyExtractor={keyById}
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
          browser.hasMore && browser.videos.length > 0 ? (
            <ListFooterSpinner />
          ) : null
        }
      />
    </Screen>
  );
}
