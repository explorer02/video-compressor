/**
 * Browser stand-in for expo-video (aliased in .storybook/main.ts). Renders a dark stage with a
 * play glyph where the player would be; the player object accepts the calls `src/` makes and
 * does nothing.
 */
import { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type VideoPlayerStub = {
  loop: boolean;
  muted: boolean;
  currentTime: number;
  play: () => void;
  pause: () => void;
  replace: (source: string | null) => void;
  replaceAsync: (source: string | null) => Promise<void>;
  addListener: (event: string, listener: () => void) => { remove: () => void };
};

function createPlayerStub(): VideoPlayerStub {
  return {
    loop: false,
    muted: false,
    currentTime: 0,
    play: () => {},
    pause: () => {},
    replace: () => {},
    replaceAsync: async () => {},
    addListener: () => ({ remove: () => {} }),
  };
}

export function useVideoPlayer(
  _source: string | null,
  setup?: (player: VideoPlayerStub) => void
): VideoPlayerStub {
  const ref = useRef<VideoPlayerStub | null>(null);
  if (ref.current === null) {
    ref.current = createPlayerStub();
    setup?.(ref.current);
  }
  return ref.current;
}

export type VideoViewProps = {
  player: VideoPlayerStub;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
};

export function VideoView({ style }: VideoViewProps) {
  return (
    <View style={[styles.stage, style]}>
      <Text style={styles.glyph}>▶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101114',
  },
  glyph: { color: '#FFFFFF', fontSize: 32, opacity: 0.6 },
});
