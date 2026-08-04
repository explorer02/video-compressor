import { StyleSheet, View } from 'react-native';

import type {
  BatchCopyMetadata,
  BatchSaveAction,
} from '../../../app/flow/types';
import type { QualityTierId } from '../../../core/compression/types';
import { canKeepOriginalMetadata } from '../../../core/metadata';
import { spacing } from '../../../theme';
import { AppText, Button, SegmentedControl, type Segment } from '../../../ui';
import { COPY_METADATA_SEGMENTS } from '../constants';
import type { BatchTotals } from '../types';
import { TotalsCard } from './TotalsCard';

/** Everything above the rows: tier choice, batch totals, metadata choice, and the bulk actions. */
export function SetupListHeader({
  tierSegments,
  tier,
  onTier,
  totals,
  copyMetadata,
  onCopyMetadata,
  onAllActions,
}: {
  tierSegments: Segment<QualityTierId>[];
  tier: QualityTierId;
  onTier: (tier: QualityTierId) => void;
  totals: BatchTotals | null;
  copyMetadata: BatchCopyMetadata;
  onCopyMetadata: (value: BatchCopyMetadata) => void;
  onAllActions: (action: BatchSaveAction) => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.section}>
        <AppText variant="captionStrong" tone="muted">
          QUALITY
        </AppText>
        <SegmentedControl
          segments={tierSegments}
          value={tier}
          onChange={onTier}
        />
      </View>

      {totals ? <TotalsCard totals={totals} /> : null}

      {canKeepOriginalMetadata ? (
        <View style={styles.section}>
          <AppText variant="captionStrong" tone="muted">
            SAVE COPIES WITH
          </AppText>
          <SegmentedControl<BatchCopyMetadata>
            segments={COPY_METADATA_SEGMENTS}
            value={copyMetadata}
            onChange={onCopyMetadata}
          />
        </View>
      ) : null}

      <View style={styles.listHeading}>
        <AppText variant="captionStrong" tone="muted">
          VIDEOS
        </AppText>
        <View style={styles.listHeadingActions}>
          <Button
            label="All copies"
            variant="secondary"
            size="sm"
            onPress={() => onAllActions('copy')}
          />
          <Button
            label="All replace"
            variant="secondary"
            size="sm"
            onPress={() => onAllActions('replace')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeadingActions: { flexDirection: 'row', gap: spacing.sm },
});
