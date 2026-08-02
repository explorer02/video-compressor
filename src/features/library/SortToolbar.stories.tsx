import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { SortToolbar } from './SortToolbar';

const meta = {
  title: 'Library/SortToolbar',
  component: SortToolbar,
  args: { onToggle: fn(), sizeSortAvailable: true },
} satisfies Meta<typeof SortToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewestFirst: Story = {
  args: { sort: { key: 'createdAt', direction: 'desc' } },
};

export const LargestFirst: Story = {
  args: { sort: { key: 'size', direction: 'desc' } },
};

export const SizeSortUnavailable: Story = {
  args: {
    sort: { key: 'createdAt', direction: 'desc' },
    sizeSortAvailable: false,
  },
};
