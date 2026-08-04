import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { MediaAccessState } from '../../../core/videoLibrary';
import type { VideoBrowser } from '../../../features/library/videoBrowser';
import { colors, spacing } from '../../../theme';
import { EmptyState } from '../../../ui';
import { activeFilterLabels } from '../utils';

/** What an empty list means: still loading, failed, filtered to nothing, or truly no videos. */
export function LibraryPlaceholder({
  browser,
  access,
}: {
  browser: VideoBrowser;
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

const styles = StyleSheet.create({
  placeholder: { paddingVertical: spacing.xxl, alignItems: 'center' },
});
