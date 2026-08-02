import { ScrollView, StyleSheet, View } from 'react-native';

import type { CompressionOutcome } from '../core/compression/types';
import {
  formatBytes,
  formatCoordinates,
  formatDateTime,
  formatFolder,
  formatResolution,
  formatSavingPercent,
} from '../core/format';
import { canKeepOriginalMetadata } from '../core/metadata';
import { playbackSource } from '../core/videoLibrary';
import { ComparisonStage } from '../features/outcome/ComparisonStage';
import { useSaveOutcome } from '../features/outcome/useSaveOutcome';
import { colors, radius, spacing } from '../theme';
import {
  AppText,
  Button,
  DetailList,
  Screen,
  useHardwareBack,
  useToast,
} from '../ui';

export type PreviewScreenProps = {
  outcome: CompressionOutcome;
  onFinished: () => void;
};

/** §3.4 — watch the result, see what it saved, then decide what happens to it. */
export function PreviewScreen({ outcome, onFinished }: PreviewScreenProps) {
  const toast = useToast();

  const save = useSaveOutcome({
    outcome,
    onSaved: message => {
      toast.show(message, 'success');
      onFinished();
    },
    onDiscarded: onFinished,
    onFailed: message => toast.show(message, 'danger'),
  });

  // Back returns to the library; while a save is in flight there is nothing safe to back out to.
  useHardwareBack(save.busy ? null : onFinished);

  const saved = formatSavingPercent(
    outcome.source.sizeBytes,
    outcome.outputSizeBytes
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/* One player, two sources: flipping between them on the same scene is what makes a
            quality difference visible, which two small players side by side would not. */}
        <ComparisonStage
          original={playbackSource(outcome.video.id)}
          compressed={outcome.outputPath}
          source={outcome.source}
        />

        <View style={styles.comparison}>
          <Measure
            label="Original"
            value={formatBytes(outcome.source.sizeBytes)}
          />
          <Measure
            label="Compressed"
            value={formatBytes(outcome.outputSizeBytes)}
            tone="success"
          />
        </View>

        {saved ? (
          <AppText variant="bodyStrong" tone="success" style={styles.saved}>
            {`${saved} smaller`}
          </AppText>
        ) : null}

        <SourceDetails outcome={outcome} />

        {/* Inside the scroll on purpose: a sticky footer of four buttons left the content a few
            lines of cramped scroll area. The page scrolls as one; the actions end it. */}
        <View style={styles.actions}>
          {canKeepOriginalMetadata ? (
            <Button
              label="Save as copy"
              hint="Keeps the original dates"
              busy={save.busy}
              onPress={() => save.saveCopy('original')}
            />
          ) : null}
          <Button
            label={
              canKeepOriginalMetadata ? 'Save with a new date' : 'Save as copy'
            }
            variant={canKeepOriginalMetadata ? 'secondary' : 'primary'}
            hint="Creation date is today, location not carried over"
            busy={save.busy}
            onPress={() => save.saveCopy('fresh')}
          />
          {/* No in-app confirmation: the OS shows its own unavoidable delete dialog, and a second
            prompt of ours in front of it read as asking twice. The stakes go on the button. */}
          <Button
            label={replaceLabel(outcome)}
            variant="danger"
            hint="Deletes the original video — the system will ask to confirm"
            disabled={save.busy}
            onPress={save.replaceOriginal}
          />
          <Button
            label="Discard"
            variant="ghost"
            onPress={save.discard}
            disabled={save.busy}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * What the original was, next to the size comparison — the facts a "keep original metadata" save
 * is promising to carry forward, so the user can see them before choosing.
 */
function SourceDetails({ outcome }: { outcome: CompressionOutcome }) {
  const { source, video } = outcome;
  const coordinates = formatCoordinates(source.location);

  return (
    <DetailList
      heading="ORIGINAL"
      items={[
        { label: 'Created', value: formatDateTime(source.capturedAt) },
        { label: 'Modified', value: formatDateTime(source.modifiedAt) },
        { label: 'Folder', value: formatFolder(source.folder ?? source.path) },
        { label: 'Filename', value: video.filename },
        {
          label: 'Resolution',
          value: formatResolution(source.width, source.height),
        },
        ...(coordinates ? [{ label: 'Location', value: coordinates }] : []),
      ]}
    />
  );
}

function Measure({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success';
}) {
  return (
    <View style={styles.measure}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading" tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

/** What replacing is worth, on the button that does it — the screen's one number that matters. */
function replaceLabel(outcome: CompressionOutcome): string {
  const freed = outcome.source.sizeBytes - outcome.outputSizeBytes;
  return freed > 0
    ? `Replace original \u2014 free up ${formatBytes(freed)}`
    : 'Replace original';
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  comparison: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  measure: { flex: 1, gap: 2 },
  saved: { textAlign: 'center' },
  // The scroll content already pads the sides; the top gap comes from the container's own `gap`.
  actions: { gap: spacing.sm },
});
