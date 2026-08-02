import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';

import type { DurationFilter } from '../../core/videoLibrary';
import { spacing } from '../../theme';

import { DurationFilterControl } from './DurationFilterControl';

/** Tap the chip to open the threshold sheet. */
function StatefulControl({ initial }: { initial: DurationFilter }) {
  const [value, setValue] = useState<DurationFilter>(initial);
  return (
    <View style={{ padding: spacing.lg, alignItems: 'flex-start' }}>
      <DurationFilterControl value={value} onChange={setValue} />
    </View>
  );
}

const meta = {
  title: 'Library/DurationFilterControl',
  component: StatefulControl,
} satisfies Meta<typeof StatefulControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = { args: { initial: null } };

export const UnderThirtySeconds: Story = {
  args: { initial: { direction: 'under', ms: 30_000 } },
};

export const AtLeastFiveMinutes: Story = {
  args: { initial: { direction: 'atLeast', ms: 300_000 } },
};
