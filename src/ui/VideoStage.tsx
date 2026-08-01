import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

export type VideoStageProps = {
  /** Null while the source is still unknown; the player picks it up as soon as it arrives. */
  source: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A video surface with the platform's own transport controls — play, pause, scrub.
 *
 * Using `nativeControls` rather than our own buttons means the controls behave exactly as they do
 * elsewhere on the device, including the accessibility affordances that come with them.
 */
export function VideoStage({
  source,
  autoPlay = false,
  loop = false,
  style,
}: VideoStageProps) {
  const player = useVideoPlayer(source, instance => {
    instance.loop = loop;
    if (autoPlay) instance.play();
  });

  return (
    <VideoView
      player={player}
      style={[styles.stage, style]}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: false }}
    />
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: colors.media,
  },
});
