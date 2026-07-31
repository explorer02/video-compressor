import { useMemo } from 'react';

import { formatBytes } from '../../core/format';
import {
  evaluateTier,
  QUALITY_TIERS,
  type TierSourceFacts,
} from '../../core/compression/tiers';
import type { QualityTierId } from '../../core/compression/types';
import { SegmentedControl, type Segment } from '../../ui';

export type TierSelectorProps = {
  facts: TierSourceFacts;
  value: QualityTierId | null;
  onChange: (tier: QualityTierId) => void;
};

/** §3.2 / §6: the tier picker, each option labelled with its estimated output size. */
export function TierSelector({ facts, value, onChange }: TierSelectorProps) {
  const segments = useMemo<Segment<QualityTierId>[]>(
    () =>
      QUALITY_TIERS.map(tier => {
        const verdict = evaluateTier(tier, facts);

        return {
          value: tier.id,
          label: tier.label,
          detail: verdict.eligible
            ? [tier.tagline, estimateLabel(verdict.estimatedBytes)]
                .filter(Boolean)
                .join(' · ')
            : tier.tagline,
          disabled: !verdict.eligible,
          disabledReason: verdict.eligible ? undefined : verdict.reason,
        };
      }),
    [facts]
  );

  return (
    <SegmentedControl segments={segments} value={value} onChange={onChange} />
  );
}

/** The "~" is load-bearing: hardware encoders land near, not on, a bitrate target (§6). */
function estimateLabel(estimatedBytes: number | null): string | null {
  return estimatedBytes === null ? null : `~${formatBytes(estimatedBytes)}`;
}
