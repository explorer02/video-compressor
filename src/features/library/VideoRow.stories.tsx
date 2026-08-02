import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import type { LibraryVideo } from '../../core/videoLibrary';

import { VideoRow } from './VideoRow';

/** In the browser the poster frame renders as an empty media-dark frame (see .storybook/mocks). */
const VIDEO: LibraryVideo = {
  id: 'mock-asset-1',
  filename: 'PXL_20260712_180432189.mp4',
  durationMs: 252_000,
  width: 3840,
  height: 2160,
  createdAt: Date.UTC(2026, 6, 12, 18, 4),
  modifiedAt: Date.UTC(2026, 6, 14, 9, 30),
};

const meta = {
  title: 'Library/VideoRow',
  component: VideoRow,
  args: {
    video: VIDEO,
    sortKey: 'createdAt',
    sizeBytes: 2_400_000_000,
    selected: null,
    onPress: fn(),
    onLongPress: fn(),
  },
} satisfies Meta<typeof VideoRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Browsing: Story = {};

export const SizeUnknown: Story = { args: { sizeBytes: null } };

export const SelectionModeUnchecked: Story = { args: { selected: false } };

export const SelectionModeChecked: Story = { args: { selected: true } };
