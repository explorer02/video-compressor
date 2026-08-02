import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../theme';
import { SegmentedControl, type Segment } from './SegmentedControl';

type TierValue = 'high' | 'medium' | 'small';

const SEGMENTS: Segment<TierValue>[] = [
  { value: 'high', label: 'High', detail: 'Near-original · ~210 MB' },
  { value: 'medium', label: 'Medium', detail: 'WhatsApp HD · ~96 MB' },
  {
    value: 'small',
    label: 'Small',
    detail: 'Fits anywhere · ~34 MB',
    disabled: true,
    disabledReason: 'Already smaller than this tier would produce',
  },
];

function StatefulControl({ initial }: { initial: TierValue | null }) {
  const [value, setValue] = useState<TierValue | null>(initial);
  return (
    <View style={{ padding: spacing.lg }}>
      <SegmentedControl segments={SEGMENTS} value={value} onChange={setValue} />
    </View>
  );
}

const meta = {
  title: 'UI/SegmentedControl',
  component: StatefulControl,
} satisfies Meta<typeof StatefulControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingSelected: Story = { args: { initial: null } };

export const Selected: Story = { args: { initial: 'medium' } };
