import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  BatchCopyMetadata,
  BatchPlan,
  BatchSaveAction,
} from '../app/flow/types';
import {
  DEFAULT_TIER_ID,
  evaluateTier,
  QUALITY_TIERS,
  tierById,
  type QualityTier,
  type TierEligibility,
} from '../core/compression/tiers';
import type { QualityTierId } from '../core/compression/types';
import {
  formatBytes,
  formatDurationWords,
  formatResolution,
  formatSavingPercent,
} from '../core/format';
import { canKeepOriginalMetadata } from '../core/metadata';
import type { LibraryVideo, VideoAssetId } from '../core/videoLibrary';
import { useBatchSourceFacts } from '../features/compression/useBatchSourceFacts';
import { VideoThumbnail } from '../features/library/VideoThumbnail';
import { colors, radius, spacing } from '../theme';
import {
  AppText,
  Button,
  Screen,
  SegmentedControl,
  useHardwareBack,
  type Segment,
} from '../ui';

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

/** §7 promises ≥ 2× real-time, so half the total footage duration is an honest rough guess. */
const ASSUMED_REALTIME_RATIO = 2;

export function BatchSetupScreen({
  videos,
  onBack,
  onStart,
}: BatchSetupScreenProps) {
  useHardwareBack(onBack);
  const { factsFor } = useBatchSourceFacts(videos);

  const [tier, setTier] = useState<QualityTierId>(DEFAULT_TIER_ID);
  const [copyMetadata, setCopyMetadata] = useState<BatchCopyMetadata>(
    canKeepOriginalMetadata ? 'original' : 'fresh'
  );
  const [actions, setActions] = useState<
    ReadonlyMap<VideoAssetId, BatchSaveAction>
  >(() => new Map());

  const actionFor = useCallback(
    (video: LibraryVideo): BatchSaveAction => actions.get(video.id) ?? 'copy',
    [actions]
  );

  const setAction = useCallback(
    (video: LibraryVideo, action: BatchSaveAction) =>
      setActions(current => new Map(current).set(video.id, action)),
    []
  );

  const setAllActions = useCallback(
    (action: BatchSaveAction) =>
      setActions(new Map(videos.map(video => [video.id, action]))),
    [videos]
  );

  // Every verdict this render needs, judged once per video.
  const verdicts = useMemo(() => {
    const chosen = tierById(tier);
    return new Map<VideoAssetId, TierEligibility>(
      videos.map(video => [video.id, evaluateTier(chosen, factsFor(video))])
    );
  }, [factsFor, tier, videos]);

  const eligible = videos.filter(video => verdicts.get(video.id)?.eligible);
  const replaceCount = eligible.filter(
    video => actionFor(video) === 'replace'
  ).length;
  const totals = batchTotals(eligible, verdicts, factsFor);

  const tierSegments = useMemo<Segment<QualityTierId>[]>(
    () =>
      QUALITY_TIERS.map(candidate =>
        tierSegment(candidate, videos, factsFor)
      ),
    [factsFor, videos]
  );

  const start = () =>
    onStart({
      items: eligible.map(video => ({ video, action: actionFor(video) })),
      tier,
      copyMetadata,
    });

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => (
      <BatchRow
        video={item}
        verdict={verdicts.get(item.id)}
        action={actionFor(item)}
        onAction={setAction}
      />
    ),
    [actionFor, setAction, verdicts]
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
        keyExtractor={keyExtractor}
        extraData={[verdicts, actions]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.section}>
              <AppText variant="captionStrong" tone="muted">
                QUALITY
              </AppText>
              <SegmentedControl
                segments={tierSegments}
                value={tier}
                onChange={setTier}
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
                  onChange={setCopyMetadata}
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
                  onPress={() => setAllActions('copy')}
                />
                <Button
                  label="All replace"
                  variant="secondary"
                  size="sm"
                  onPress={() => setAllActions('replace')}
                />
              </View>
            </View>
          </View>
        }
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

function BatchRow({
  video,
  verdict,
  action,
  onAction,
}: {
  video: LibraryVideo;
  verdict: TierEligibility | undefined;
  action: BatchSaveAction;
  onAction: (video: LibraryVideo, action: BatchSaveAction) => void;
}) {
  const eligible = verdict?.eligible === true;

  return (
    <View style={styles.row}>
      <VideoThumbnail
        assetId={video.id}
        durationMs={video.durationMs}
        style={styles.thumbnail}
      />

      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {video.filename}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {rowMeta(video)}
        </AppText>
        <AppText
          variant="caption"
          tone={eligible ? 'accent' : 'muted'}
          numberOfLines={1}
        >
          {rowVerdict(verdict)}
        </AppText>
      </View>

      {eligible ? (
        <View style={styles.rowActions}>
          <ActionPill
            label="Copy"
            selected={action === 'copy'}
            onPress={() => onAction(video, 'copy')}
          />
          <ActionPill
            label="Replace"
            selected={action === 'replace'}
            onPress={() => onAction(video, 'replace')}
          />
        </View>
      ) : null}
    </View>
  );
}

function ActionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      size="sm"
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
    />
  );
}

type BatchTotals = {
  sourceBytes: number;
  estimatedBytes: number;
  savedLabel: string | null;
  roughTime: string | null;
};

function TotalsCard({ totals }: { totals: BatchTotals }) {
  return (
    <View style={styles.totals}>
      <AppText variant="heading">
        {`${formatBytes(totals.sourceBytes)}  →  ~${formatBytes(totals.estimatedBytes)}`}
      </AppText>
      <AppText variant="caption" tone="muted">
        {[
          totals.savedLabel ? `saves ~${totals.savedLabel}` : null,
          totals.roughTime ? `roughly ${totals.roughTime}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </View>
  );
}

/** Sums only what is knowable; a batch where nothing has a size yet shows no card at all. */
function batchTotals(
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
function tierSegment(
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

const COPY_METADATA_SEGMENTS: Segment<BatchCopyMetadata>[] = [
  {
    value: 'original',
    label: 'Original dates',
    detail: 'Copies keep the capture date and location',
  },
  {
    value: 'fresh',
    label: 'Fresh metadata',
    detail: 'Copies are dated today, location not carried over',
  },
];

function rowMeta(video: LibraryVideo): string {
  return [
    formatResolution(video.width, video.height),
    video.durationMs === null ? null : formatDurationWords(video.durationMs),
  ]
    .filter(Boolean)
    .join(' · ');
}

function rowVerdict(verdict: TierEligibility | undefined): string {
  if (!verdict) return '';
  if (!verdict.eligible) return `Skipped — ${decapitalize(verdict.reason)}`;
  return verdict.estimatedBytes === null
    ? 'Will be compressed'
    : `→ ~${formatBytes(verdict.estimatedBytes)}`;
}

function decapitalize(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

function keyExtractor(video: LibraryVideo): string {
  return video.id;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  barSpacer: { width: 48 },
  header: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  totals: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeadingActions: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  thumbnail: { width: 64, height: 64 },
  rowBody: { flex: 1, gap: 2 },
  rowActions: { gap: spacing.xs },
  actions: { padding: spacing.lg, gap: spacing.sm },
  replaceNote: { textAlign: 'center' },
});
