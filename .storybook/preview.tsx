import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../src/theme';

/** Stories render inside a phone-width column so layouts read the way they do on a device. */
const PHONE_WIDTH = 390;

const preview: Preview = {
  decorators: [
    Story => (
      <SafeAreaProvider>
        <View
          style={{
            width: PHONE_WIDTH,
            maxWidth: '100%',
            minHeight: 200,
            backgroundColor: colors.background,
          }}
        >
          <Story />
        </View>
      </SafeAreaProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        surface: { name: 'surface', value: colors.surface },
        media: { name: 'media', value: colors.media },
      },
    },
  },
};

export default preview;
