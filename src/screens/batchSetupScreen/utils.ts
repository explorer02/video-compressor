import {
  evaluateTier,
  type QualityTier,
  type TierEligibility,
} from '../../core/compression/tiers';
import type { QualityTierId } from '../../core/compression/types';
import {
  formatBytes,
  formatDurationWords,
  formatResolution,
  formatSavingPercent,
} from '../../core/format';
import type { LibraryVideo, VideoAssetId } from '../../core/videoLibrary';
import type { Segment } from '../../ui';
import { decapitalize, plural } from '../../utils/text';
import { ASSUMED_REALTIME_RATIO } from './constants';
import type { BatchTotals } from './types';

/** Sums only what is knowable; a batch where nothing has a size yet shows no card at all. */
export function batchTotals(
  eligible: LibraryVideo[],
  verdicts: ReadonlyMap<VideoAssetId, TierEligibility>,
  factsFor: (video: LibraryVideo) => { sizeBytes: number | null }
): BatchTotals | null {
  let sourceBytes = 0;
  let estimatedBytes = 0;
  let durationMs = 0;

  for (const video of eligible) {
    const verdict = verdicts.get(video.id);
    const sizeBytes = factsFor(video).sizeBytes;
    if (!verdict?.eligible || verdict.estimatedBytes === null || !sizeBytes) {
      continue;
    }
    sourceBytes += sizeBytes;
    estimatedBytes += verdict.estimatedBytes;
    durationMs += video.durationMs ?? 0;
  }

  if (sourceBytes === 0 || estimatedBytes === 0) return null;

  const savedPercent = formatSavingPercent(sourceBytes, estimatedBytes);
  return {
    sourceBytes,
    estimatedBytes,
    savedLabel: savedPercent
      ? `${formatBytes(sourceBytes - estimatedBytes)} (${savedPercent})`
      : null,
    roughTime:
      durationMs > 0
        ? formatDurationWords(durationMs / ASSUMED_REALTIME_RATIO)
        : null,
  };
}

/** A tier's segment speaks for the whole batch: how many videos it fits and what they add up to. */
export function tierSegment(
  tier: QualityTier,
  videos: LibraryVideo[],
  factsFor: (video: LibraryVideo) => Parameters<typeof evaluateTier>[1]
): Segment<QualityTierId> {
  let eligibleCount = 0;
  let estimatedBytes = 0;

  for (const video of videos) {
    const verdict = evaluateTier(tier, factsFor(video));
    if (!verdict.eligible) continue;
    eligibleCount += 1;
    estimatedBytes += verdict.estimatedBytes ?? 0;
  }

  return {
    value: tier.id,
    label: tier.label,
    detail:
      eligibleCount > 0
        ? [
            `${eligibleCount} of ${videos.length} ${plural(videos.length, 'video')}`,
            estimatedBytes > 0 ? `~${formatBytes(estimatedBytes)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined,
    disabled: eligibleCount === 0,
    disabledReason: 'No selected video can use this tier',
  };
}

export function rowMeta(video: LibraryVideo): string {
  return [
    formatResolution(video.width, video.height),
    video.durationMs === null ? null : formatDurationWords(video.durationMs),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function rowVerdict(verdict: TierEligibility | undefined): string {
  if (!verdict) return '';
  if (!verdict.eligible) return `Skipped — ${decapitalize(verdict.reason)}`;
  return verdict.estimatedBytes === null
    ? 'Will be compressed'
    : `→ ~${formatBytes(verdict.estimatedBytes)}`;
}
