import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

import { spacing } from '../../theme';

import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Compression/ProgressBar',
  component: ProgressBar,
  decorators: [
    Story => (
      <View style={{ padding: spacing.lg }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Starting: Story = { args: { fraction: 0 } };

export const Midway: Story = { args: { fraction: 0.45 } };

export const Done: Story = { args: { fraction: 1 } };
