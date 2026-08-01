import { Alert, ScrollView, StyleSheet, View } from 'react-native';

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
import { useSaveOutcome } from '../features/outcome/useSaveOutcome';
import { colors, radius, spacing } from '../theme';
import {
  AppText,
  Button,
  Screen,
  useHardwareBack,
  useToast,
  VideoStage,
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
        <VideoStage source={outcome.outputPath} autoPlay loop />

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
      </ScrollView>

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
        <Button
          label="Replace original"
          variant="danger"
          hint="Deletes the original video"
          disabled={save.busy}
          onPress={() => confirmReplace(save.replaceOriginal)}
        />
        <Button
          label="Discard"
          variant="ghost"
          onPress={save.discard}
          disabled={save.busy}
        />
      </View>
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
    <View style={styles.details}>
      <AppText variant="captionStrong" tone="muted">
        ORIGINAL
      </AppText>
      <Detail label="Created" value={formatDateTime(source.capturedAt)} />
      <Detail label="Modified" value={formatDateTime(source.modifiedAt)} />
      <Detail label="Folder" value={formatFolder(source.path)} />
      <Detail label="Filename" value={video.filename} />
      <Detail
        label="Resolution"
        value={formatResolution(source.width, source.height)}
      />
      {coordinates ? <Detail label="Location" value={coordinates} /> : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="caption" numberOfLines={1} style={styles.detailValue}>
        {value}
      </AppText>
    </View>
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

/**
 * §3.4 — our own warning first. The OS will show its own delete confirmation afterwards, which
 * cannot be bypassed, but by then the user has already agreed to the intent.
 */
function confirmReplace(onConfirm: () => void): void {
  Alert.alert(
    'Replace the original?',
    'The compressed video is saved to your gallery and the original is deleted. This can\u2019t be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: onConfirm },
    ]
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  details: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  comparison: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  measure: { flex: 1, gap: 2 },
  saved: { textAlign: 'center' },
  actions: { padding: spacing.lg, gap: spacing.sm },
});
