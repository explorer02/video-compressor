import { useMemo, useState } from 'react';

import {
  DEFAULT_TIER_ID,
  evaluateTier,
  QUALITY_TIERS,
  tierById,
  type TierEligibility,
  type TierSourceFacts,
} from '../../../core/compression/tiers';
import type { QualityTierId } from '../../../core/compression/types';
import type { LibraryVideo, VideoAssetId } from '../../../core/videoLibrary';
import type { Segment } from '../../../ui';
import { batchTotals, tierSegment } from '../utils';
import type { BatchTotals } from '../types';

export type BatchEligibility = {
  tier: QualityTierId;
  setTier: (tier: QualityTierId) => void;
  verdicts: ReadonlyMap<VideoAssetId, TierEligibility>;
  /** The videos the chosen tier can actually shrink — the ones the batch will contain. */
  eligible: LibraryVideo[];
  totals: BatchTotals | null;
  tierSegments: Segment<QualityTierId>[];
};

/** What the chosen tier means for this batch: who is in, what it adds up to, per-tier counts. */
export function useBatchEligibility(
  videos: LibraryVideo[],
  factsFor: (video: LibraryVideo) => TierSourceFacts
): BatchEligibility {
  const [tier, setTier] = useState<QualityTierId>(DEFAULT_TIER_ID);

  // Every verdict this render needs, judged once per video.
  const verdicts = useMemo(() => {
    const chosen = tierById(tier);
    return new Map<VideoAssetId, TierEligibility>(
      videos.map(video => [video.id, evaluateTier(chosen, factsFor(video))])
    );
  }, [factsFor, tier, videos]);

  // Memoized so a row's Copy/Replace flip doesn't re-filter and re-sum the whole batch.
  const eligible = useMemo(
    () => videos.filter(video => verdicts.get(video.id)?.eligible),
    [verdicts, videos]
  );
  const totals = useMemo(
    () => batchTotals(eligible, verdicts, factsFor),
    [eligible, factsFor, verdicts]
  );

  const tierSegments = useMemo<Segment<QualityTierId>[]>(
    () =>
      QUALITY_TIERS.map(candidate => tierSegment(candidate, videos, factsFor)),
    [factsFor, videos]
  );

  // A stable object, so the screen's header-element memo keyed on it survives unrelated re-renders.
  return useMemo(
    () => ({ tier, setTier, verdicts, eligible, totals, tierSegments }),
    [tier, verdicts, eligible, totals, tierSegments]
  );
}
