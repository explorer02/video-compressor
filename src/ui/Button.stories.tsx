import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { label: 'Compress', onPress: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Danger: Story = {
  args: { variant: 'danger', label: 'Delete original' },
};

export const Ghost: Story = { args: { variant: 'ghost', label: 'Not now' } };

export const Small: Story = { args: { size: 'sm', label: 'Select all' } };

export const WithHint: Story = {
  args: {
    label: 'Save video',
    hint: 'Original capture date + location',
  },
};

export const Busy: Story = { args: { busy: true } };

export const Disabled: Story = { args: { disabled: true } };
