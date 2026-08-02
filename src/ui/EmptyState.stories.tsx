import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { EmptyState } from './EmptyState';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  args: { title: 'No videos yet' },
};

export const WithMessageAndAction: Story = {
  args: {
    title: 'No videos match',
    message: 'Nothing in your library is at least 500 MB.',
    action: { label: 'Clear filter', onPress: fn() },
  },
};
