import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { View } from 'react-native';

import type { BatchPlan } from '../../app/flow/types';
import {
  useBatchCompressionJob,
  type BatchItem,
} from '../../features/compression/batchCompressionJob';
import { AppText, Button, Screen, useHardwareBack } from '../../ui';
import { BatchHeader } from './components/BatchHeader';
import { BatchItemRow } from './components/BatchItemRow';
import { styles } from './styles';
import { batchItemKey } from './utils';

/**
 * The batch in motion, then its reckoning — one screen, because the list of videos is the story in
 * both phases: what each row is doing now, and afterwards, what each one became.
 */

export type BatchCompressingScreenProps = {
  plan: BatchPlan;
  onDone: () => void;
};

export function BatchCompressingScreen({
  plan,
  onDone,
}: BatchCompressingScreenProps) {
  const job = useBatchCompressionJob(plan);
  const running = job.phase !== 'finished';

  // While running, back means the same as Cancel: stop the queue, never abandon it silently.
  useHardwareBack(running ? job.cancel : onDone);

  const renderItem = useCallback(
    ({ item }: { item: BatchItem }) => <BatchItemRow item={item} />,
    []
  );

  return (
    <Screen>
      <FlashList
        data={job.items}
        renderItem={renderItem}
        keyExtractor={batchItemKey}
        extraData={job.items}
        ListHeaderComponent={
          <BatchHeader job={job} total={plan.items.length} />
        }
      />

      <View style={styles.actions}>
        {running ? (
          <>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={job.cancel}
              disabled={job.cancelled}
            />
            <AppText variant="caption" tone="muted" style={styles.centered}>
              Videos already finished stay saved.
            </AppText>
          </>
        ) : (
          <Button label="Done" onPress={onDone} />
        )}
      </View>
    </Screen>
  );
}
