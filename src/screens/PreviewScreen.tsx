import { useVideoPlayer, VideoView } from 'expo-video';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import type { CompressionOutcome } from '../core/compression/types';
import { formatBytes, formatSavingPercent } from '../core/format';
import { canKeepOriginalMetadata } from '../core/metadata';
import { useSaveOutcome } from '../features/outcome/useSaveOutcome';
import { colors, radius, spacing } from '../theme';
import { AppText, Button, Screen, useToast } from '../ui';

export type PreviewScreenProps = {
  outcome: CompressionOutcome;
  onFinished: () => void;
};

/** §3.4 — watch the result, see what it saved, then decide what happens to it. */
export function PreviewScreen({ outcome, onFinished }: PreviewScreenProps) {
  const toast = useToast();

  const player = useVideoPlayer(outcome.outputPath, instance => {
    instance.loop = true;
    instance.play();
  });

  const save = useSaveOutcome({
    outcome,
    onSaved: message => {
      toast.show(message, 'success');
      onFinished();
    },
    onDiscarded: onFinished,
    onFailed: message => toast.show(message, 'danger'),
  });

  const saved = formatSavingPercent(
    outcome.source.sizeBytes,
    outcome.outputSizeBytes
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <VideoView
          player={player}
          style={styles.player}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: false }}
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
      </ScrollView>

      <View style={styles.actions}>
        {canKeepOriginalMetadata ? (
          <Button
            label="Save as copy"
            hint="Keeps the original capture date"
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
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: colors.media,
  },
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
