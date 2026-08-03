import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';
import { capPlayerBuffering } from './videoBuffering';

export type VideoStageProps = {
  /** Null while the source is still unknown; the player picks it up as soon as it arrives. */
  source: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A video surface with the platform's own transport controls — play, pause, scrub, fullscreen.
 *
 * Using `nativeControls` rather than our own buttons means the controls behave exactly as they do
 * elsewhere on the device, including the accessibility affordances that come with them. Fullscreen
 * is left at the API's default (enabled) rather than opted out of.
 */
export function VideoStage({
  source,
  autoPlay = false,
  loop = false,
  style,
}: VideoStageProps) {
  const player = useVideoPlayer(source, instance => {
    capPlayerBuffering(instance);
    instance.loop = loop;
    if (autoPlay) instance.play();
  });

  return (
    <VideoView
      player={player}
      style={[styles.stage, style]}
      contentFit="contain"
      nativeControls
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
