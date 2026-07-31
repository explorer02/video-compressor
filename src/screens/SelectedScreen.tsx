import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  DEFAULT_TIER_ID,
  evaluateTier,
  isAlreadyOptimized,
  sourceFactsFrom,
  tierById,
} from '../core/compression/tiers';
import type { QualityTierId, SourceVideo } from '../core/compression/types';
import {
  formatBytes,
  formatDurationWords,
  formatResolution,
} from '../core/format';
import { readSourceVideo } from '../core/metadata';
import { sizeIndex } from '../core/sizeIndex';
import type { LibraryVideo } from '../core/videoLibrary';
import { TierSelector } from '../features/compression/TierSelector';
import { VideoThumbnail } from '../features/library/VideoThumbnail';
import { colors, radius, spacing } from '../theme';
import { AppText, Banner, Button, Screen, useToast } from '../ui';

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
  const sizeBytes = sizeIndex.get(video);
  const facts = useMemo(
    () => sourceFactsFrom(video, sizeBytes),
    [sizeBytes, video]
  );

  const [tier, setTier] = useState<QualityTierId | null>(() =>
    defaultEligibleTier(facts)
  );
  const [resolving, setResolving] = useState(false);
  const optimized = isAlreadyOptimized(facts);

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
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <VideoThumbnail assetId={video.id} style={styles.hero} />

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

/** HD is the default (§3.2), unless the source has outgrown it. */
function defaultEligibleTier(
  facts: Parameters<typeof isAlreadyOptimized>[0]
): QualityTierId | null {
  if (evaluateTier(tierById(DEFAULT_TIER_ID), facts).eligible) {
    return DEFAULT_TIER_ID;
  }
  return evaluateTier(tierById('fullHd'), facts).eligible ? 'fullHd' : null;
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.sm, alignItems: 'flex-start' },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { width: '100%', aspectRatio: 16 / 9 },
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
