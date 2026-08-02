import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

import { spacing } from '../theme';
import { DetailList } from './DetailList';

const meta = {
  title: 'UI/DetailList',
  component: DetailList,
  decorators: [
    Story => (
      <View style={{ padding: spacing.lg }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof DetailList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VideoFacts: Story = {
  args: {
    heading: 'ORIGINAL',
    items: [
      { label: 'Size', value: '2.4 GB' },
      { label: 'Resolution', value: '3840 × 2160' },
      { label: 'Duration', value: '4 min 12 s' },
      { label: 'Frame rate', value: '60 fps' },
      { label: 'Captured', value: '12 Jul 2026, 18:04' },
    ],
  },
};

export const LongValues: Story = {
  args: {
    items: [
      {
        label: 'Filename',
        value: 'PXL_20260712_180432189.LONG_EXPOSURE-01.COVER.mp4',
      },
      { label: 'Folder', value: 'DCIM/Camera' },
    ],
  },
};
