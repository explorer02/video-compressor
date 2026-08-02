import { resolve } from 'node:path';

import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { mergeConfig } from 'vite';

const mock = (file: string) => resolve(process.cwd(), '.storybook/mocks', file);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {},
  },
  /**
   * Native-only modules cannot load in a browser (they call `requireNativeModule` at import
   * time), so the browser build swaps each one for a stand-in from `.storybook/mocks/`. The
   * mocks mirror only the surface `src/` actually uses.
   */
  viteFinal: viteConfig =>
    mergeConfig(viteConfig, {
      plugins: [
        {
          name: 'shortenaf:native-module-mocks',
          enforce: 'pre',
          resolveId(source: string) {
            if (source === 'expo-video') return mock('expo-video.tsx');
            if (source === 'expo-image') return mock('expo-image.tsx');
            if (source === 'expo-media-library') {
              return mock('expo-media-library.ts');
            }
            if (source === 'expo-file-system') {
              return mock('expo-file-system.ts');
            }
            if (source.endsWith('modules/media-tools')) {
              return mock('media-tools.ts');
            }
            return null;
          },
        },
      ],
    }),
};

export default config;
