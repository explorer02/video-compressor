import { useMemo, useState } from 'react';

import type { BatchCopyMetadata, BatchPlan } from '../../app/flow/types';
import { canKeepOriginalMetadata } from '../../core/metadata';
import { useBatchSourceFacts } from '../../features/compression/useBatchSourceFacts';
import { useHardwareBack } from '../../ui';
import type { BatchSetupScreenProps } from './BatchSetupScreen';
import { useBatchActions } from './hooks/useBatchActions';
import { useBatchEligibility } from './hooks/useBatchEligibility';

/** All of the batch-setup state and verbs; the screen component only renders them. */
export function useBatchSetupScreen({
  videos,
  onBack,
  onStart,
}: BatchSetupScreenProps) {
  useHardwareBack(onBack);
  const { factsFor } = useBatchSourceFacts(videos);

  const actions = useBatchActions(videos);
  const eligibility = useBatchEligibility(videos, factsFor);

  const [copyMetadata, setCopyMetadata] = useState<BatchCopyMetadata>(
    canKeepOriginalMetadata ? 'original' : 'fresh'
  );

  const replaceCount = useMemo(
    () =>
      eligibility.eligible.filter(
        video => actions.actionFor(video) === 'replace'
      ).length,
    [actions, eligibility.eligible]
  );

  const start = () => {
    const plan: BatchPlan = {
      items: eligibility.eligible.map(video => ({
        video,
        action: actions.actionFor(video),
      })),
      tier: eligibility.tier,
      copyMetadata,
    };
    onStart(plan);
  };

  return {
    actions,
    eligibility,
    copyMetadata,
    setCopyMetadata,
    replaceCount,
    start,
  };
}
