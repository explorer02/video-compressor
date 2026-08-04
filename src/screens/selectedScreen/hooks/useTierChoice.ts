import { useMemo, useState } from 'react';

import {
  isAlreadyOptimized,
  sourceFactsFrom,
  type TierSourceFacts,
} from '../../../core/compression/tiers';
import type { QualityTierId } from '../../../core/compression/types';
import { sizeIndex } from '../../../core/sizeIndex';
import type { LibraryVideo } from '../../../core/videoLibrary';
import {
  useVideoDetails,
  type VideoDetails,
} from '../../../features/library/useVideoDetails';
import { defaultEligibleTier } from '../utils';

export type TierChoice = {
  details: VideoDetails;
  sizeBytes: number | null;
  facts: TierSourceFacts;
  tier: QualityTierId | null;
  setTier: (tier: QualityTierId | null) => void;
  /** True when no tier can make this video smaller (§5's "Already optimized"). */
  optimized: boolean;
};

/** Everything the §3.2 tier picker knows about the source, plus the chosen tier. */
export function useTierChoice(video: LibraryVideo): TierChoice {
  const details = useVideoDetails(video);
  const sizeBytes = sizeIndex.get(video);
  // The real frame rate matters: a 60 fps source doubles the manual bitrate at encode time, so
  // estimating at the 30 fps assumption would show half the size the encoder is about to produce.
  const facts = useMemo(
    () => sourceFactsFrom(video, sizeBytes, details.frameRate ?? undefined),
    [details.frameRate, sizeBytes, video]
  );

  const [tier, setTier] = useState<QualityTierId | null>(() =>
    defaultEligibleTier(facts)
  );
  const optimized = isAlreadyOptimized(facts);

  return { details, sizeBytes, facts, tier, setTier, optimized };
}
