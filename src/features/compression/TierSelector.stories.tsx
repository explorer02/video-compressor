import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';

import type { TierSourceFacts } from '../../core/compression/tiers';
import type { QualityTierId } from '../../core/compression/types';
import { spacing } from '../../theme';

import { TierSelector } from './TierSelector';

/** A 4K 60 fps minute — every tier has something to offer. */
const LARGE_SOURCE: TierSourceFacts = {
  width: 3840,
  height: 2160,
  durationMs: 60_000,
  sizeBytes: 480_000_000,
  frameRate: 60,
};

/** Already small — lower tiers should disable themselves. */
const SMALL_SOURCE: TierSourceFacts = {
  width: 640,
  height: 360,
  durationMs: 12_000,
  sizeBytes: 2_000_000,
  frameRate: 30,
};

function StatefulSelector({ facts }: { facts: TierSourceFacts }) {
  const [tier, setTier] = useState<QualityTierId | null>(null);
  return (
    <View style={{ padding: spacing.lg }}>
      <TierSelector facts={facts} value={tier} onChange={setTier} />
    </View>
  );
}

const meta = {
  title: 'Compression/TierSelector',
  component: StatefulSelector,
} satisfies Meta<typeof StatefulSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LargeSource: Story = { args: { facts: LARGE_SOURCE } };

export const SmallSource: Story = { args: { facts: SMALL_SOURCE } };
