import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import type { BatchPlan } from '../../app/flow/types';
import type { LibraryVideo } from '../../core/videoLibrary';
import { AppText, Button, Screen } from '../../ui';
import { keyById } from '../../utils/list';
import { plural } from '../../utils/text';
import { BatchRow } from './components/BatchRow';
import { SetupListHeader } from './components/SetupListHeader';
import { styles } from './styles';
import { useBatchSetupScreen } from './useBatchSetupScreen';

/**
 * Batch setup: the selected videos, one quality tier for all of them, and a per-video choice of
 * what a finished compression becomes — a new copy, or a replacement for the original.
 *
 * §7's single-encoder reality means the batch runs one video at a time; this screen's job is to
 * make what is about to happen legible before any of it starts.
 */

export type BatchSetupScreenProps = {
  videos: LibraryVideo[];
  onBack: () => void;
  onStart: (plan: BatchPlan) => void;
};

export function BatchSetupScreen(props: BatchSetupScreenProps) {
  const { videos, onBack } = props;
  const {
    actions,
    eligibility,
    copyMetadata,
    setCopyMetadata,
    replaceCount,
    start,
  } = useBatchSetupScreen(props);
  const { eligible } = eligibility;

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => (
      <BatchRow
        video={item}
        verdict={eligibility.verdicts.get(item.id)}
        action={actions.actionFor(item)}
        onAction={actions.setAction}
      />
    ),
    [actions, eligibility.verdicts]
  );

  // A stable header element lets FlashList skip re-rendering it when only row actions change.
  const listHeader = useMemo(
    () => (
      <SetupListHeader
        tierSegments={eligibility.tierSegments}
        tier={eligibility.tier}
        onTier={eligibility.setTier}
        totals={eligibility.totals}
        copyMetadata={copyMetadata}
        onCopyMetadata={setCopyMetadata}
        onAllActions={actions.setAllActions}
      />
    ),
    [actions.setAllActions, copyMetadata, eligibility, setCopyMetadata]
  );

  return (
    <Screen>
      <View style={styles.bar}>
        <Button label="Back" variant="ghost" onPress={onBack} />
        <AppText variant="heading">{`Compress ${videos.length} videos`}</AppText>
        <View style={styles.barSpacer} />
      </View>

      <FlashList
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyById}
        extraData={[eligibility.verdicts, actions]}
        ListHeaderComponent={listHeader}
      />

      <View style={styles.actions}>
        {replaceCount > 0 ? (
          <AppText variant="caption" tone="muted" style={styles.replaceNote}>
            {`${replaceCount} ${plural(replaceCount, 'original')} will be deleted after compressing — the system asks once to confirm.`}
          </AppText>
        ) : null}
        <Button
          label={
            eligible.length > 0
              ? `Compress ${eligible.length} ${plural(eligible.length, 'video')}`
              : 'Nothing to compress'
          }
          disabled={eligible.length === 0}
          onPress={start}
        />
      </View>
    </Screen>
  );
}
