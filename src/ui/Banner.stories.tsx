import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { Banner } from './Banner';

const meta = {
  title: 'UI/Banner',
  component: Banner,
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageOnly: Story = {
  args: { message: 'The library changed while you were away.' },
};

export const WithAction: Story = {
  args: {
    message: 'You have given access to only some videos.',
    action: { label: 'Manage', onPress: fn() },
  },
};
