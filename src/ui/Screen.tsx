import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

type ScreenProps = {
  children: ReactNode;
  /** Screens with their own scroll view opt out of bottom padding. */
  edges?: { bottom?: boolean };
  background?: string;
};

/** Full-bleed screen container that respects the device's safe areas. */
export function Screen({
  children,
  edges,
  background = colors.background,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: background,
          paddingTop: insets.top,
          paddingBottom: edges?.bottom === false ? 0 : insets.bottom,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
