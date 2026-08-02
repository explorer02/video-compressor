/**
 * Browser stand-in for expo-image (aliased in .storybook/main.ts). Real asset URIs
 * (`ph://`, `content://`) cannot load in a browser, so those render as an empty frame; http(s)
 * sources — what stories pass — render with the plain react-native-web image.
 */
import {
  Image as WebImage,
  View,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

export type ImageProps = {
  source: string | { uri?: string } | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'contain' | 'cover' | 'fill';
  transition?: number;
};

export function Image({ source, style, contentFit }: ImageProps) {
  const uri = typeof source === 'string' ? source : (source?.uri ?? null);

  if (uri !== null && /^https?:/.test(uri)) {
    return (
      <WebImage
        source={{ uri }}
        style={style}
        resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
      />
    );
  }
  return <View style={style} />;
}
