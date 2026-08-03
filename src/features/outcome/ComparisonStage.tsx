import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useRef, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { SourceVideo } from '../../core/compression/types';
import { colors, radius, spacing } from '../../theme';
import {
  Button,
  capPlayerBuffering,
  SegmentedControl,
  type Segment,
} from '../../ui';

/**
 * §3.4's comparison player: one surface, two sources, flipped in place.
 *
 * A single player is deliberate — switching swaps the file under the same playback clock, so the
 * user compares the same moment in both versions instead of starting over. The stage also sizes
 * itself to the video's own aspect ratio, so a portrait clip fills the width of the screen rather
 * than shrinking into a 16:9 letterbox; Expand puts the same player over the whole window with the
 * switcher still in reach, which the native fullscreen button cannot offer.
 */

type Side = 'original' | 'compressed';

const SIDES: Segment<Side>[] = [
  { value: 'original', label: 'Original' },
  { value: 'compressed', label: 'Compressed' },
];

/** Inline, the stage leaves room for the numbers and actions below; Expand exists for the rest. */
const MAX_INLINE_HEIGHT_FRACTION = 0.55;

export type ComparisonStageProps = {
  original: string;
  compressed: string;
  /** Supplies the aspect ratio and rotation the stage sizes itself with. */
  source: SourceVideo;
};

export function ComparisonStage({
  original,
  compressed,
  source,
}: ComparisonStageProps) {
  const [showing, setShowing] = useState<Side>('compressed');
  const [expanded, setExpanded] = useState(false);
  const window = useWindowDimensions();

  const player = useVideoPlayer(compressed, instance => {
    capPlayerBuffering(instance);
    instance.loop = true;
    instance.play();
  });

  // Mirrors `showing` for the callback, and increments per switch so a slow load that loses a
  // race against a newer switch cannot seek the player afterwards.
  const showingRef = useRef<Side>('compressed');
  const generation = useRef(0);

  const switchTo = useCallback(
    (side: Side) => {
      if (side === showingRef.current) return;
      showingRef.current = side;
      setShowing(side);

      const token = ++generation.current;
      const resumeAt = player.currentTime;
      const wasPlaying = player.playing;

      void (async () => {
        try {
          await player.replaceAsync(
            side === 'original' ? original : compressed
          );
          if (token !== generation.current) return;
          // Same clock, other file: pick up at the frame the user was just looking at.
          player.currentTime = resumeAt;
          if (wasPlaying) player.play();
        } catch (error) {
          console.warn('[preview] could not switch comparison source', error);
        }
      })();
    },
    [compressed, original, player]
  );

  const inlineHeight = inlineStageHeight(source, window);

  return (
    <View style={styles.stack}>
      <SegmentedControl segments={SIDES} value={showing} onChange={switchTo} />

      {/* The player renders in exactly one place at a time; while expanded, the inline slot keeps
          its size so closing the modal does not reflow the screen. */}
      {expanded ? (
        <View style={[styles.stage, { height: inlineHeight }]} />
      ) : (
        <VideoView
          player={player}
          style={[styles.stage, { height: inlineHeight }]}
          contentFit="contain"
          nativeControls
        />
      )}

      <Button
        label="Expand preview"
        variant="secondary"
        size="sm"
        onPress={() => setExpanded(true)}
      />

      <Modal
        visible={expanded}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.fullscreen}>
          <VideoView
            player={player}
            style={styles.fullscreenStage}
            contentFit="contain"
            nativeControls
          />
          <View style={styles.fullscreenControls}>
            <SegmentedControl
              segments={SIDES}
              value={showing}
              onChange={switchTo}
            />
            <Button
              label="Close"
              variant="secondary"
              onPress={() => setExpanded(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** The height that shows the video at its own aspect ratio, capped so the page still scrolls. */
function inlineStageHeight(
  source: SourceVideo,
  window: { width: number; height: number }
): number {
  const stageWidth = window.width - spacing.lg * 2;
  const natural = stageWidth / displayAspectRatio(source);
  return Math.round(
    Math.min(natural, window.height * MAX_INLINE_HEIGHT_FRACTION)
  );
}

function displayAspectRatio(source: SourceVideo): number {
  // 90°/270° rotation means the file's stored dimensions are sideways to how it displays.
  const swapped = source.rotationDegrees % 180 !== 0;
  const width = swapped ? source.height : source.width;
  const height = swapped ? source.width : source.height;
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  stage: {
    width: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.media,
  },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  fullscreenStage: { flex: 1 },
  fullscreenControls: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
});
