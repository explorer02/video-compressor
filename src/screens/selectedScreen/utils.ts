import {
  DEFAULT_TIER_ID,
  evaluateTier,
  QUALITY_TIERS,
  tierById,
  type TierSourceFacts,
} from '../../core/compression/tiers';
import type { QualityTierId } from '../../core/compression/types';
import { assetExists, type LibraryVideo } from '../../core/videoLibrary';

/** "It failed" and "it is gone" call for different exits; a failed check counts as still there. */
export async function isGone(video: LibraryVideo): Promise<boolean> {
  try {
    return !(await assetExists(video.id));
  } catch {
    return false;
  }
}

/** HD is the default (§3.2); when it doesn't apply, the first tier that does. */
export function defaultEligibleTier(
  facts: TierSourceFacts
): QualityTierId | null {
  if (evaluateTier(tierById(DEFAULT_TIER_ID), facts).eligible) {
    return DEFAULT_TIER_ID;
  }
  const fallback = QUALITY_TIERS.find(
    tier => evaluateTier(tier, facts).eligible
  );
  return fallback?.id ?? null;
}
