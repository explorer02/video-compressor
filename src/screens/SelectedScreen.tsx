import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import {
  DEFAULT_TIER_ID,
  evaluateTier,
  isAlreadyOptimized,
  QUALITY_TIERS,
  sourceFactsFrom,
  tierById,
} from '../core/compression/tiers';
import type { QualityTierId, SourceVideo } from '../core/compression/types';
import {
  formatBytes,
  formatDateTime,
  formatDurationWords,
  formatFolder,
  formatResolution,
} from '../core/format';
import { readSourceVideo } from '../core/metadata';
import { sizeIndex } from '../core/sizeIndex';
import { playbackSource, type LibraryVideo } from '../core/videoLibrary';
import { TierSelector } from '../features/compression/TierSelector';
import { useDeleteVideos } from '../features/library/useDeleteVideos';
import { useVideoDetails } from '../features/library/useVideoDetails';
import { colors, radius, spacing } from '../theme';
import {
  AppText,
  Banner,
  Button,
  DetailList,
  Screen,
  useHardwareBack,
  useToast,
  VideoStage,
} from '../ui';

export type SelectedScreenProps = {
  video: LibraryVideo;
  onBack: () => void;
  onStart: (source: SourceVideo, tier: QualityTierId) => void;
};

/** §3.2 — the chosen video, its original stats, and the quality tier to compress it to. */
export function SelectedScreen({
  video,
  onBack,
  onStart,
}: SelectedScreenProps) {
  const toast = useToast();
  useHardwareBack(onBack);
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
  const [resolving, setResolving] = useState(false);
  const optimized = isAlreadyOptimized(facts);

  const deletion = useDeleteVideos({
    onDeleted: message => {
      toast.show(message, 'success');
      onBack();
    },
    onKept: message => toast.show(message),
    onFailed: message => toast.show(message, 'danger'),
  });

  // Resolving a real path is the expensive call, so it happens once, here, on the way to encoding.
  const start = () => {
    if (!tier || resolving) return;
    setResolving(true);

    void (async () => {
      try {
        onStart(await readSourceVideo(video), tier);
      } catch (error) {
        console.warn('[selected] failed to read source video', error);
        toast.show('That video is no longer available.', 'danger');
        onBack();
      } finally {
        setResolving(false);
      }
    })();
  };

  return (
    <Screen>
      <View style={styles.bar}>
        <Button label="Back" variant="ghost" onPress={onBack} />
        {/* Lives in the bar, not the action row, so a redundant video can be deleted even when
            it is already optimized and there is nothing to compress. */}
        <Button
          label="Delete"
          variant="danger"
          busy={deletion.busy}
          disabled={resolving}
          onPress={() =>
            confirmDelete(video.filename, () => deletion.remove([video]))
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <VideoStage source={playbackSource(video.id)} />

        <AppText variant="heading" numberOfLines={2}>
          {video.filename}
        </AppText>

        <View style={styles.stats}>
          <Stat
            label="Resolution"
            value={formatResolution(video.width, video.height)}
          />
          <Stat
            label="Duration"
            value={formatDurationWords(video.durationMs)}
          />
          <Stat
            label="Size"
            value={sizeBytes === null ? '—' : formatBytes(sizeBytes)}
          />
        </View>

        <DetailList
          items={[
            { label: 'Created', value: formatDateTime(details.capturedAt) },
            { label: 'Modified', value: formatDateTime(details.modifiedAt) },
            { label: 'Folder', value: formatFolder(details.folder) },
          ]}
        />

        {optimized ? (
          <Banner message="Already optimized — compressing this video would not make it smaller." />
        ) : (
          <View style={styles.tiers}>
            <AppText variant="captionStrong" tone="muted">
              QUALITY
            </AppText>
            <TierSelector facts={facts} value={tier} onChange={setTier} />
          </View>
        )}
      </ScrollView>

      {optimized ? null : (
        <View style={styles.actions}>
          <Button
            label="Compress"
            onPress={start}
            disabled={tier === null}
            busy={resolving}
          />
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

/**
 * Our own warning first. The OS shows its own delete confirmation afterwards, which cannot be
 * bypassed, but by then the user has already agreed to the intent.
 */
function confirmDelete(filename: string, onConfirm: () => void): void {
  Alert.alert(
    'Delete this video?',
    `${filename} will be removed from your device. This can’t be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]
  );
}

/** HD is the default (§3.2); when it doesn't apply, the first tier that does. */
function defaultEligibleTier(
  facts: Parameters<typeof isAlreadyOptimized>[0]
): QualityTierId | null {
  if (evaluateTier(tierById(DEFAULT_TIER_ID), facts).eligible) {
    return DEFAULT_TIER_ID;
  }
  const fallback = QUALITY_TIERS.find(
    tier => evaluateTier(tier, facts).eligible
  );
  return fallback?.id ?? null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, gap: 2 },
  tiers: { gap: spacing.sm },
  actions: { padding: spacing.lg },
});
